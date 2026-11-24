# ADR 0003: Catálogo de entidades e contexto investigativo

- **Status:** Proposto — requer validação de privacidade
- **Contexto:** a mesma pessoa/organização pode aparecer em várias investigações, mas cada caso tem relações, fontes e qualificações próprias.
- **Decisão:** identidade de entidade separada do vínculo `InvestigationEntity`; relações/evidências pertencem à investigação e usam endpoints contextuais. `Person` e `Organization` são extensões tipadas de `Entity`.
- **Consequências:** permite deduplicação sem universalizar alegações; exige autorização rigorosa e decisão sobre quais atributos podem ser compartilhados. ID global nunca basta para obter acesso.
- **Alternativas consideradas:** duplicar entidade em cada caso (mais isolamento, mas reconciliação difícil); cadastro global com todos atributos (maior risco de vazamento entre casos).
