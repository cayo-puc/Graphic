# Segurança e limites do protótipo

Este MVP é local e não implementa autenticação, autorização multiusuário, auditoria nem armazenamento de documentos. Fontes são metadados e referências em texto, sem upload.

Use somente dados fictícios ou públicos apropriados. O servidor escuta em loopback (`127.0.0.1`); não exponha a API em rede pública. Proteja `data/graph.json` e faça cópias de segurança conforme necessário. O formato JSON não tem garantias de concorrência, transação ou recuperação.

Classificações de relacionamento (`DOCUMENTED`, `REPORTED`, `ALLEGED`, `UNCONFIRMED`) são qualificadores informados pelo usuário. Métricas de rede não classificam suspeitos nem provam influência, irregularidade ou responsabilidade.
