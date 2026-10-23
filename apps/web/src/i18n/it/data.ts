import type { ErrorTexts } from '@daiq/data';

export const data: ErrorTexts = {
  unauthenticated: 'La sessione è scaduta. Accedi di nuovo.',
  forbidden: 'Non hai il permesso di farlo.',
  not_found: 'Questo elemento non esiste più o non puoi accedervi.',
  conflict: 'Esiste già.',
  validation: 'Alcuni valori non sono validi.',
  rate_limited: 'Troppe richieste. Attendi un momento e riprova.',
  network: 'Sembra che tu sia offline. Le modifiche verranno salvate quando ti riconnetti.',
  unknown: 'Si è verificato un errore imprevisto. Riprova.',
  fileTooLarge: (name, size, max) =>
    `${name} pesa ${size}; i file possono pesare al massimo ${max}.`,
};
