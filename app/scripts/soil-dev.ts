import { DevLlm } from '../src/soil/llm/devLlm';
import { explainReport, answerQuestion } from '../src/soil/engine';
import { SAMPLE_REPORT } from '../src/soil/sample';

(async () => {
  const llm = new DevLlm();
  console.log('--- EXPLAIN ---');
  console.log((await explainReport(SAMPLE_REPORT, { llm, lang: 'hi' })).text);
  console.log('--- Q: फॉस्फोरस ज़्यादा है क्या करूँ? ---');
  console.log((await answerQuestion('मेरी रिपोर्ट में फॉस्फोरस ज़्यादा है, क्या करूँ?', SAMPLE_REPORT, { llm, lang: 'hi' })).text);
})();
