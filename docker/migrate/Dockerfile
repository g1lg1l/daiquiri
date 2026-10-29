# Applies supabase/migrations/*.sql in order, once each (ADR-0012).
FROM postgres:18-alpine
COPY supabase/migrations /migrations
COPY docker/migrate/migrate.sh /usr/local/bin/daiq-migrate
RUN chmod 0755 /usr/local/bin/daiq-migrate
USER postgres
ENTRYPOINT ["daiq-migrate"]
