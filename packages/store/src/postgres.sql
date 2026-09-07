-- Postgres. The deployment target; SQLite is the zero-setup local driver.
-- Same shape, real JSONB, and a GIN index the inbound query can use.

CREATE TABLE IF NOT EXISTS document (
  id          uuid        NOT NULL,
  variant     text        NOT NULL CHECK (variant IN ('draft', 'published')),
  type        text        NOT NULL,
  route       text,
  data        jsonb       NOT NULL,
  schema_ver  int         NOT NULL,
  version     int         NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        NOT NULL,
  PRIMARY KEY (id, variant)
);

CREATE UNIQUE INDEX IF NOT EXISTS doc_route_published
  ON document (route)
  WHERE variant = 'published' AND route IS NOT NULL;

CREATE INDEX IF NOT EXISTS doc_type_variant ON document (type, variant);
CREATE INDEX IF NOT EXISTS doc_refs ON document USING gin ((data -> 'refs'));

CREATE TABLE IF NOT EXISTS document_version (
  id          uuid        NOT NULL,
  version     int         NOT NULL,
  data        jsonb       NOT NULL,
  schema_ver  int         NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        NOT NULL,
  PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS document_ref (
  document_id   uuid NOT NULL,
  variant       text NOT NULL,
  target        text NOT NULL,
  target_source text NOT NULL,
  field_path    text NOT NULL,
  to_type       text NOT NULL,
  PRIMARY KEY (document_id, variant, field_path)
);

CREATE INDEX IF NOT EXISTS doc_ref_target ON document_ref (target);
