-- Must run before any vector column can be created
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable: add embedding and tsv columns
ALTER TABLE "Chunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(2048),
  ADD COLUMN IF NOT EXISTS "tsv"       tsvector;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS "Chunk_tsv_idx"
  ON "Chunk" USING GIN(tsv);

-- Backfill existing rows
UPDATE "Chunk" SET tsv = to_tsvector('english', content) WHERE tsv IS NULL;

-- Auto-update trigger for new/updated chunks
CREATE OR REPLACE FUNCTION chunk_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunk_tsv_trigger ON "Chunk";
CREATE TRIGGER chunk_tsv_trigger
  BEFORE INSERT OR UPDATE ON "Chunk"
  FOR EACH ROW EXECUTE FUNCTION chunk_tsv_update();
