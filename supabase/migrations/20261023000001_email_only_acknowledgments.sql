-- Acknowledgments are delivered by email only (no print-and-mail).
update donors set e_delivery_consent = true where e_delivery_consent = false;
alter table donors alter column e_delivery_consent set default true;
update acknowledgments set delivery = 'email' where delivery <> 'email';
alter table acknowledgments drop constraint if exists acknowledgments_delivery_check;
alter table acknowledgments add constraint acknowledgments_delivery_check check (delivery = 'email');
alter table acknowledgments drop column if exists mail_provider_ref;
