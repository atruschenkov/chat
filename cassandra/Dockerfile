FROM cassandra:3.11.3

COPY schema.cql /schema.cql
COPY entrypoint-wrap.sh /usr/local/bin/

ENTRYPOINT ["entrypoint-wrap.sh"]

CMD ["cassandra", "-f"]