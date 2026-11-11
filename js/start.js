// Einstieg: zuerst die Sprache laden, dann die App. So stehen alle Texte bereit, bevor ein Modul der App läuft.
import './huelle.js';
import { ladeSprache } from './sprache.js';

ladeSprache().then(() => import('./app.js'));
