alter table learning_sessions drop constraint learning_sessions_provider_check;
alter table learning_sessions add constraint learning_sessions_provider_check
  check (provider in ('sarvam', 'elevenlabs', 'none', 'simulation'));
