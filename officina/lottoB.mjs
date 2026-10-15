// Agente B (lotto F/E): un solo punto di aggancio in app.mjs per catalogo modelli, storico, riparazioni esterne, prestiti e note.
import { registerModelRoutes, MODEL_TABLES } from './modelli.mjs';
import { registerStoricoRoutes } from './storico.mjs';
import { registerExternalRoutes, externalAlerts, EXTERNAL_TABLES } from './esterne.mjs';
import { registerLoanRoutes, loanAlerts, LOAN_TABLES } from './prestiti.mjs';
import { registerNoteRoutes, NOTE_TABLES } from './note.mjs';

export function registerLottoB(app, h) {
  registerModelRoutes(app, h);
  registerStoricoRoutes(app, h);
  registerExternalRoutes(app, h);
  registerLoanRoutes(app, h);
  registerNoteRoutes(app, h);
}

/** Avvisi di campanella e "Oggi": rientri esterni in ritardo, muletti non rientrati. */
export const lottoBAlerts = async () => [...(await externalAlerts()), ...(await loanAlerts())];

/** Tabelle da includere nel backup. */
export const LOTTO_B_TABLES = [...MODEL_TABLES, ...EXTERNAL_TABLES, ...LOAN_TABLES, ...NOTE_TABLES];
