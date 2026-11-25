# ADR 0003: Catálogo de entidades e contexto investigativo

- **Status:** Implementado no esquema v2.0.0 do MVP
- **Contexto:** a mesma pessoa/organização pode aparecer em várias investigações, mas cada caso tem relações, fontes e qualificações próprias.
- **Decisão:** catálogo global de entidades separado da associação `investigation_entities`; cada relação pertence a uma investigação e cada evidência liga a relação a uma fonte com localização e trecho.
- **Consequências:** permite reutilizar identidade sem transferir automaticamente papel, alegação ou desfecho jurídico entre investigações. Autorização multiusuário ainda não está implementada no protótipo local.
- **Alternativas consideradas:** duplicar entidade em cada caso (mais isolamento, mas reconciliação difícil); cadastro global com todos atributos (maior risco de vazamento entre casos).
