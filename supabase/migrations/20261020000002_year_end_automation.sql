-- Year-end runs without a sign-off: acknowledgments release when the tie-out passes.
alter table acknowledgments add column if not exists mail_provider_ref text;   -- Lob letter id for mailed acknowledgments
alter table irs_reports add column if not exists submission_ref text;          -- IRS SGO portal confirmation number
