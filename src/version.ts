/**
 * La versione mostrata nel menu.
 *
 * Sta in un file suo e non in `package.json` perché il pacchetto non si
 * importa dal codice del sito: farlo trascinerebbe dentro il bundle tutto il
 * manifesto, dipendenze comprese.
 */
export const APP_VERSION = '0.2.0';
