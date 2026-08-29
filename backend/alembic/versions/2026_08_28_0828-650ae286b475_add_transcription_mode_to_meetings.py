"""add transcription_mode to meetings

Revision ID: 650ae286b475
Revises: 293138585702
Create Date: 2026-08-28 08:28:31.139075+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '650ae286b475'
down_revision: Union[str, None] = '293138585702'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only add the column missing from the DB. The other diffs detected by
    # autogenerate (indexes / FK already present in DB but not declared in the
    # ORM metadata) are intentionally NOT included, to avoid dropping and
    # rebuilding the pgvector embedding index (idx_decisions_embedding) and
    # other existing indexes.
    op.add_column('meetings', sa.Column('transcription_mode', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'transcription_mode')
