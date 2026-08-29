"""无录音跑通 Multi-Agent 全链路：直接灌入一场「研发评审会议」的转写数据。

为什么可以不用录音：
    summary_service._build_transcript_text() 只查 transcripts 表，
    按 seq_index 拼接 "[{speaker}]: {content}" —— 与音频文件完全无关。
    音频只在上游 ASR 环节被用到，而这一步可以整段跳过。

用法（在 backend 目录下执行）：
    PYTHONUTF8=1 PYTHONPATH=. ./.venv/Scripts/python.exe scripts/seed_review_meeting.py

跑完后：
    1. 脚本会打印 meeting_id
    2. 调用 POST http://localhost:8787/api/meetings/{meeting_id}/summarize
       （或直接在前端会议详情页点「生成纪要」）
    3. 打开 Agent 监控页观察 planner → fan-out → validator 的完整执行

转写内容是刻意设计的，包含：
    - 明确决策（HNSW，含决策人与具体参数）
    - 三个候选方案及其 pros/cons（供 option_extractor 结构化）
    - 反对意见（李薇反对 Milvus，刘洋附议）
    - 行动项（2 条，带负责人和截止时间）
    - 风险（2 条）
    - 被推迟的议题（rerank 模型）
    确保 decision_detector 的「决策/提议/推迟」三种标签都能被命中。
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.db.session import async_session_factory
from app.models.meeting import Meeting
from app.models.transcript import Transcript

MEETING_TITLE = "Yuan-Meet 决策库向量索引选型评审"
MEETING_DESC = "评审决策库向量索引从 ivfflat 迁移到 HNSW 的方案（演示用种子数据）"

# (说话人, 内容) —— 每段按 SEG_SECONDS 依次推进时间戳
SEG_SECONDS = 25.0

SEGMENTS: list[tuple[str, str]] = [
    ("陈昊", "各位，今天这场评审要定一件事：决策库的向量索引方案。先说背景，目前决策库积累了大概十二万条决策记录，用的是 pgvector 的 ivfflat 索引，lists 设的 100。"),
    ("李薇", "我补充一下现状的问题。最近两周监控到语义检索的召回率从 92% 掉到 78%，尤其是那些表述相近但结论相反的条目，特别容易漏掉。"),
    ("陈昊", "对，所以今天要在三个方案里选一个。第一个是改用 HNSW 索引，第二个是把 ivfflat 的 lists 参数重新调优，第三个是干脆把向量检索从 PostgreSQL 拆出来，换成 Milvus。"),
    ("王磊", "我先说 HNSW。它基于多层图结构，查询复杂度接近对数级，召回率在我们的测试集上能稳定到 97% 以上。缺点是索引构建慢，内存和磁盘占用大概是 ivfflat 的两倍。"),
    ("李薇", "磁盘这块我算过。十二万条 1024 维向量，HNSW 索引大概占 1.8 个 G，ivfflat 只要 900 兆左右。我们实例还有 40G 空间，倒不是瓶颈。"),
    ("张敏", "从产品角度我关心延迟。现在对话页是双路检索加 LLM 流式输出，端到端已经接近两秒了，索引再变慢用户会明显感觉到。"),
    ("王磊", "HNSW 的查询延迟反而更低，P99 大概 35 毫秒，ivfflat 调优前是 60 毫秒。这是它最大的优势。"),
    ("陈昊", "第二个方案，ivfflat 调优，王磊你测过吗？"),
    ("王磊", "测过。lists 从 100 调到 400、probes 设成 20，召回率能回到 88%，但也就到头了。再往上加 probes，延迟会线性上涨，得不偿失。"),
    ("李薇", "而且 ivfflat 有个硬伤：它需要先有数据才能建索引，数据分布变了索引就失效，得定期重建。决策库是持续增长的，这个维护成本不低。"),
    ("陈昊", "第三个方案，Milvus。谁支持？"),
    ("王磊", "我先说优点：Milvus 是为向量检索专门设计的，分片、水平扩展、混合检索都更成熟，数据量再涨十倍也不虚。"),
    ("李薇", "但我反对。这会引入一个新的中间件，运维复杂度直接翻倍。而且决策数据和业务数据现在在同一个事务里写入，拆出去之后一致性怎么保证？这部分工作量至少两个 sprint。"),
    ("刘洋", "我同意李薇的顾虑。另外从测试角度说，多加一个组件意味着多一套故障注入场景，我们现在的混沌测试用例还没覆盖全 Redis 挂掉的情况。"),
    ("张敏", "排期上也不允许。季度目标里承诺的是决策检索准确率提升，不是架构升级。引入 Milvus 至少要延后一个月。"),
    ("陈昊", "那我总结一下：Milvus 长期看最优，但当前阶段成本太高，先不做。HNSW 和 ivfflat 调优之间，HNSW 召回率高 9 个百分点，延迟还更低，代价是索引体积翻倍和构建时间变长。"),
    ("李薇", "构建时间我补充一下实测数据：十二万条数据建 HNSW 索引大概要 14 分钟，ivfflat 只要 3 分钟。但我们可以在低峰期做，而且是一次性的。"),
    ("刘洋", "迁移过程会不会影响线上服务？决策库现在是只读的，但我担心索引重建期间查询会阻塞。"),
    ("王磊", "不会。可以用 CREATE INDEX CONCURRENTLY 在线建索引，建完再切换，中间查询走老索引。这个我有把握。"),
    ("陈昊", "好，那我拍板了：决策库的向量索引从 ivfflat 迁移到 HNSW，m 设 16，ef_construction 设 200，查询时 ef_search 设 40。"),
    ("李薇", "同意。我负责迁移脚本，需要先在预发环境用全量数据验一遍。"),
    ("陈昊", "行动项我说一下。王磊，下周三之前出一份 HNSW 的召回率和延迟压测报告，要覆盖十万、五十万、一百万三个数据量级。"),
    ("王磊", "收到。另外我想提醒一个风险：HNSW 的参数一旦定下来，后续调优成本很高，ef_search 调大会直接拖慢查询。我建议先在预发环境把这几个参数扫一遍再定死。"),
    ("陈昊", "这个风险我记下了，就按你说的，参数在预发环境扫描后再固化。张敏，产品经理这边需要同步什么？"),
    ("张敏", "我要在季度复盘里用召回率这个指标，迁移完成后麻烦给我一份前后对比数据。"),
    ("李薇", "我这边还有一个风险要提：索引体积翻倍之后，备份窗口会变长。我们现在的全量备份是四十分钟，可能会拖到一个半小时，得错开业务高峰。"),
    ("陈昊", "好，记录为风险项。最后一个议题，要不要引入 rerank 模型做二次排序？"),
    ("王磊", "现在代码里 _rerank 是纯启发式打分，没有模型。引入 rerank 能进一步提升准确率，但需要额外一次模型调用，延迟会增加 200 毫秒左右。"),
    ("陈昊", "这个议题今天不定，等 HNSW 迁移完成、有了干净的召回率基线之后再评审。刘洋你把这个议题记到待办里。"),
    ("刘洋", "好，我记下了。"),
    ("陈昊", "那今天的评审就到这里。决议是迁移到 HNSW，行动项两个，风险两个，rerank 议题推迟到下个迭代。"),
]


async def main() -> None:
    async with async_session_factory() as db:
        # 幂等：同标题的旧演示会议先清掉（含关联数据，避免外键冲突）
        old = (
            await db.execute(
                select(Meeting).where(Meeting.title == MEETING_TITLE)
            )
        ).scalars().all()
        for m in old:
            await db.execute(delete(Transcript).where(Transcript.meeting_id == m.id))
            await db.delete(m)
        if old:
            await db.flush()
            print(f"[seed] 清理旧演示会议 {len(old)} 场")

        now = datetime.now(timezone.utc)
        meeting = Meeting(
            title=MEETING_TITLE,
            description=MEETING_DESC,
            # 注意：participants 是 PostgreSQL ARRAY(String)，必须传 list 而非逗号字符串
            participants=["陈昊", "李薇", "王磊", "张敏", "刘洋"],
            start_time=now,
            end_time=now + timedelta(seconds=int(len(SEGMENTS) * SEG_SECONDS)),
            status="processed",
            transcription_mode="seed",
        )
        db.add(meeting)
        await db.flush()
        await db.refresh(meeting)

        for i, (speaker, content) in enumerate(SEGMENTS):
            db.add(
                Transcript(
                    meeting_id=meeting.id,
                    speaker=speaker,
                    content=content,
                    start_time=round(i * SEG_SECONDS, 2),
                    end_time=round(i * SEG_SECONDS + SEG_SECONDS - 0.5, 2),
                    seq_index=i,
                )
            )
        await db.commit()

    print()
    print("=" * 64)
    print(f"  会议已创建：{MEETING_TITLE}")
    print(f"  转写片段：{len(SEGMENTS)} 条")
    print(f"  meeting_id = {meeting.id}")
    print("=" * 64)
    print()
    print("下一步（任选其一）：")
    print(f"  A. curl -X POST http://localhost:8787/api/meetings/{meeting.id}/summarize")
    print( "  B. 打开前端会议详情页 → 点「生成纪要」")
    print( "  C. 打开 http://localhost:8787/docs 找到 /meetings/{id}/summarize 试一把")
    print()
    print("生成后去 Agent 监控页看 planner 的路由决策和四个 Agent 的耗时。")


if __name__ == "__main__":
    asyncio.run(main())
