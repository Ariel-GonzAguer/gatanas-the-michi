# Testing

Suite con `node --test` (test runner de la librería estándar) sobre la
compilación de tests. Sin dependencias de testing: ni vitest, ni jest.

## 1. Resumen

29 pruebas en 4 archivos, todas sin red y sin disco real: cada módulo con
comportamiento recibe sus colaboradores por inyección y los tests usan
dobles. `npm test` compila y corre todo.

## 2. Comando y configuración

```bash
npm test   # tsc -p tsconfig.test.json && node --test dist-test/test/*.test.js
```

`tsconfig.test.json` compila `src/` + `test/` a `dist-test/` con `rootDir`
en la raíz del proyecto; los tests importan desde `../src/*.js`.

## 3. Archivos y cobertura

| Archivo | Qué fija | Pruebas |
|---------|----------|---------|
| `test/diet.test.ts` | El contrato de la heurística: umbrales exactos de disco (92/80), errores (8/3), zombis (3 avistamientos), tofus rechazados que degradan a hoja, GPU sin vidas que baja a tofu. | 14 |
| `test/collect.test.ts` | Qué es presa y qué no: disco medido con `statfs` inyectable, zombis vs procesos normales, logs frescos vs viejos. | 4 |
| `test/hunt.test.ts` | El motor completo con voz postiza: no repite hallazgo el mismo día, hojas sin tokens, monedero vacío que frena, entrega fallida que no rompe la caza, gasto acumulado en el acta. | 5 |
| `test/lives.test.ts` | El pacto de las vidas: nace con 9, perder cuesta 1, gastar restaura el checkpoint, la vida se devuelve si la restauración falla, sin llave no hay restauración, renacer no borra regalos. | 6 |

## 4. Dobles y fixtures

| Doble | Ubicación | Uso |
|-------|-----------|-----|
| `fixtureCollector(preyList)` | `src/hunt.ts` | Colector de presas fijo para el motor. |
| `fakeSpritesApi({fail})` | `src/lives.ts` | Plano de control falso con checkpoints en memoria. |
| `FakeVoice` | `test/hunt.test.ts` | Voz que registra llamadas y responde fijo. |
| `deps.statfs` inyectable | `src/collect.ts` | Medidor de disco reemplazable (`CollectDeps.statfs`). |
| `GATANAS_TEST_STATFS` | `src/collect.ts` | Alternativa por variable de entorno. |

## 5. Convenciones

- Asserts con `node:assert/strict`; `assert.deepEqual` para contratos de
  forma (kinds de regalos) y `assert.match` para textos.
- Fechas congeladas (`nowIso` fijo) en los tests del motor para que
  `giftedKeys` y ventanas de frescura sean deterministas.
- Directorios temporales por test (`fs.mkdtemp`) para el acta: nunca se
  toca el `GATANAS_HOME` real.

## 6. Sin tests configurados (integración)

La integración real (gateway de Sprites, plano de control, OpenRouter) no
tiene suite automatizada: se valida con el smoke manual documentado en
[workflow](workflow.md) y con los endpoints vivos del altar.

## Referencias

- [Caza y dieta](../features/caza-y-dieta.md) (la suite más cargada)
- [Workflow de desarrollo](workflow.md)
- Configuración: `tsconfig.test.json`, `package.json`
