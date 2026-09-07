"""Output Validator 节点：消费 Harness 校验结果 + 回灌重试

Harness 负责校验和清洗输出；本节点只根据校验结果控制回灌。
失败时返回 retry_node 让工作流重试对应 Agent。
重试上限 2 次，超出则保留原始输出（兜底）并标记 errors。
"""

import logging

logger = logging.getLogger(__name__)

VALIDATED_NODES = ("summary_agent", "action_items_agent", "risks_agent")

MAX_RETRY_PER_NODE = 2


async def output_validator_node(state: dict) -> dict:
    """输出校验节点

    返回值：
    - {"valid": True}：Harness 报告所有已执行节点校验通过
    - {"valid": False, "retry_node": "xxx", "retry_reason": "xxx"}：回灌重试
    - {"valid": False, "errors": [...]}：重试耗尽，标记错误
    """
    errors = []
    validation_results = state.get("validation_results", {})

    for node_name in VALIDATED_NODES:
        # 该节点是否在本次执行计划中
        plan = state.get("plan", {})
        if not _should_run_node(node_name, plan):
            continue

        validation = validation_results.get(node_name)
        if validation is None:
            continue

        if validation.get("ok"):
            continue

        msg = validation.get("reason") or "输出校验失败"

        # 校验失败：尝试回灌重试
        retry_count = state.get(f"{node_name}_retry", 0)
        if retry_count < MAX_RETRY_PER_NODE:
            logger.warning(
                f"[Validator] {node_name} 校验失败 (retry {retry_count + 1}/{MAX_RETRY_PER_NODE}): {msg}"
            )
            return {
                "valid": False,
                "retry_node": node_name,
                "retry_reason": msg,
                f"{node_name}_retry": retry_count + 1,
            }

        # 重试耗尽：保留原始输出，标记错误
        logger.error(f"[Validator] {node_name} 重试耗尽，保留原始输出: {msg}")
        errors.append(f"{node_name} 输出校验失败（重试耗尽）: {msg}")

    if errors:
        # 显式清掉回灌信号，防止 router 误判为还要重试。
        return {
            "valid": False,
            "errors": errors,
            "retry_node": None,
            "retry_reason": None,
        }

    return {
        "valid": True,
        "retry_node": None,
        "retry_reason": None,
    }


def _should_run_node(node_name: str, plan: dict) -> bool:
    """根据 Planner 计划判断该节点是否应该执行"""
    if not plan:
        return True
    if node_name == "summary_agent":
        return plan.get("should_run_summary", True)
    if node_name == "action_items_agent":
        return plan.get("should_run_actions", True)
    if node_name == "risks_agent":
        return plan.get("should_run_risks", True)
    return True
