-- Stop storing any digits of a caller's phone number.
--
-- learners.phone_last4 kept the last four digits in clear, written before the
-- caller had agreed to anything, and was only ever used to tell whether caller
-- ID was available. A boolean answers that question without holding any part
-- of the number; the number itself survives only as an HMAC in
-- learner_identities.

alter table public.learners add column if not exists caller_id_known boolean not null default false;
update public.learners set caller_id_known = true where phone_last4 is not null;
alter table public.learners drop column if exists phone_last4;
