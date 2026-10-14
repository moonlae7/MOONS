// One-shot setup for the MOONS event deployment on Vercel.
// Asks only for the OpenAI API key, then:
//   1. checks the key and the models MOONS uses,
//   2. creates a Postgres database (Claimable Neon, no account needed) unless one is already set,
//   3. writes OPENAI_API_KEY, DATABASE_URL and ADMIN_TOKEN to the Vercel project (production),
//   4. redeploys production and checks that the universe API answers.
// Run from any folder on your own computer (Node 20.19+):
//   node -e "fetch('https://raw.githubusercontent.com/moonlae7/MOONS/main/scripts/connect-vercel.mjs').then(r=>r.text()).then(t=>import('data:text/javascript;base64,'+Buffer.from(t).toString('base64')))"
// Secrets are never printed (except the new ADMIN_TOKEN, which you need for /admin) and the temp folder is deleted.

import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import readline from 'node:readline';

const SITE = 'https://moons-nine.vercel.app';
const SCOPE = 'luxyvenoms-projects';
const ORG_ID = 'team_9gEZ11OTkHbGuI6q6WzwAMym';
const PROJECT_ID = 'prj_HfFnvUeY6H7Zi1GfszXpvYeF1ir6';
const SPACE = 'hackathon-1014';
const isWin = process.platform === 'win32';

const say = (msg = '') => console.log(msg);
const step = (n, msg) => say(`\n[${n}/5] ${msg}`);
const fail = msg => { say(`\n실패: ${msg}`); cleanup(); process.exit(1); };

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) fail(`Node.js 20.19 이상이 필요해요. 지금 버전은 ${process.versions.node}입니다. https://nodejs.org 에서 LTS를 설치한 뒤 다시 실행해 주세요.`);

// Temp folder linked to the Vercel project, so the CLI needs no prompts.
const work = mkdtempSync(join(tmpdir(), 'moons-connect-'));
mkdirSync(join(work, '.vercel'));
writeFileSync(join(work, '.vercel', 'project.json'), JSON.stringify({projectId: PROJECT_ID, orgId: ORG_ID}));
function cleanup() { try { rmSync(work, {recursive: true, force: true}); } catch {} }
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// Captured commands never get the keyboard: a hidden prompt would hang the script.
// They fail fast instead, and the script runs the interactive step (login) on its own.
function run(cmd, args, {input, capture = false, timeout = 0} = {}) {
  const r = spawnSync(cmd, args, {
    cwd: work, encoding: 'utf8', shell: isWin, input, timeout: timeout || undefined,
    stdio: [input !== undefined ? 'pipe' : capture ? 'ignore' : 'inherit', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
  });
  return {ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, timedOut: r.error?.code === 'ETIMEDOUT'};
}
const vercel = (args, opts) => run('npx', ['-y', 'vercel@latest', ...args], opts);

function askHidden(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    const rl = readline.createInterface({input: process.stdin, output: process.stdout, terminal: true});
    rl._writeToOutput = () => {}; // do not echo the secret
    rl.question('', answer => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

say('MOONS 연결을 시작합니다. 중간에 Vercel 로그인 창이 한 번 뜰 수 있어요.');

// 1. OpenAI key
step(1, 'OpenAI API 키 확인');
let key = process.env.OPENAI_API_KEY?.trim();
if (!key) key = await askHidden('OpenAI API 키를 붙여넣고 Enter를 누르세요 (화면에 안 보이는 게 정상이에요): ');
if (!key) fail('키가 비어 있어요.');
let models = [];
try {
  const res = await fetch('https://api.openai.com/v1/models', {headers: {Authorization: `Bearer ${key}`}});
  if (res.status === 401) fail('OpenAI가 이 키를 거절했어요. 키를 다시 복사해 주세요.');
  if (!res.ok) fail(`OpenAI 확인 중 오류가 났어요 (HTTP ${res.status}).`);
  models = (await res.json()).data.map(m => m.id);
} catch (e) { if (e?.message) fail(`OpenAI에 연결하지 못했어요: ${e.message}`); }
const pick = list => list.find(m => models.includes(m));
const env = {OPENAI_API_KEY: key};
const fast = pick(['gpt-5.4-mini', 'gpt-5-mini']);
const deep = pick(['gpt-5.4', 'gpt-5']);
const voice = pick(['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1']);
const embed = pick(['text-embedding-3-small']);
if (!fast || !deep) fail('이 키로 쓸 수 있는 GPT-5 계열 모델이 없어요. OpenAI 대시보드에서 프로젝트 권한을 확인해 주세요.');
if (fast !== 'gpt-5.4-mini') env.OPENAI_MODEL = fast;
if (deep !== 'gpt-5.4') env.OPENAI_MODEL_DEEP = deep;
if (voice && voice !== 'gpt-4o-transcribe') env.OPENAI_TRANSCRIBE_MODEL = voice;
say(`키 정상. 구조화 ${fast}, 갈림길 ${deep}, 음성 ${voice ?? '없음 (말로 답하기 불가)'}, 연결 ${embed ?? '없음'}`);
if (!embed) say('주의: text-embedding-3-small을 못 쓰면 생각끼리 연결이 안 생겨요.');

// 2. Vercel login
step(2, 'Vercel 로그인 확인');
say('Vercel CLI를 준비하는 중이에요. 처음에는 1분 정도 걸릴 수 있어요.');
const me = vercel(['whoami', '--non-interactive'], {capture: true, timeout: 180000});
if (me.ok) say(`로그인됨: ${me.out.trim().split(/\r?\n/).pop()}`);
else {
  say('Vercel 로그인이 필요해요. 아래 안내대로 브라우저에서 로그인을 마쳐 주세요.');
  if (!vercel(['login']).ok) fail('Vercel 로그인을 마치지 못했어요.');
}
const listed = vercel(['env', 'ls', 'production', '--scope', SCOPE, '--non-interactive'], {capture: true, timeout: 180000});
if (!listed.ok) fail(`moons 프로젝트의 환경변수를 읽지 못했어요. ${SCOPE} 팀에 접근할 수 있는 계정으로 로그인했는지 확인해 주세요.\n${listed.out.slice(-400)}`);
const has = name => new RegExp(`\\b${name}\\b`).test(listed.out);

// 3. Database
step(3, '데이터베이스 준비');
if (has('DATABASE_URL')) say('이미 DATABASE_URL이 있어서 그대로 씁니다.');
else {
  say('Neon에 임시 Postgres를 만듭니다. 계정 없이 바로 만들어져요.');
  run('npx', ['-y', 'neon@latest', 'claim', 'create']);
  let url = '';
  for (const f of ['.env', '.env.local']) {
    const p = join(work, f);
    if (!existsSync(p)) continue;
    const line = readFileSync(p, 'utf8').split(/\r?\n/).find(l => /^\s*DATABASE_URL\s*=/.test(l));
    if (line) url = line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^["']|["']$/g, '');
  }
  if (!url) {
    say('자동으로 만들지 못했어요. Neon 콘솔(https://console.neon.tech)에서 만든 연결 주소가 있다면 붙여넣어 주세요.');
    url = await askHidden('DATABASE_URL (postgres://... , 화면에 안 보여요): ');
  }
  if (!/^postgres(ql)?:\/\//.test(url)) fail('DATABASE_URL을 얻지 못했어요.');
  env.DATABASE_URL = url;
  say('DB 준비 완료. 이 DB는 임시라서 행사 뒤에도 쓰려면 나중에 `npx neon@latest claim accept`로 내 계정에 가져오세요.');
}
let adminToken = '';
if (has('ADMIN_TOKEN')) say('ADMIN_TOKEN은 이미 있어서 그대로 둡니다.');
else env.ADMIN_TOKEN = adminToken = randomBytes(24).toString('hex');

// 4. Write env vars and redeploy
step(4, 'Vercel에 환경변수 저장 후 재배포');
for (const [name, value] of Object.entries(env)) {
  const r = vercel(['env', 'add', name, 'production', '--force', '--scope', SCOPE], {input: value, capture: true, timeout: 120000});
  if (!r.ok) fail(`${name} 저장 실패.\n${r.out.slice(-400)}`);
  say(`  ${name} 저장됨`);
}
say('재배포 중이에요. 1~2분 걸려요.');
const deployed = vercel(['redeploy', SITE, '--target', 'production', '--scope', SCOPE, '--non-interactive'], {capture: true, timeout: 600000});
if (!deployed.ok) fail(`재배포 실패. Vercel 대시보드의 Deployments에서 Redeploy를 눌러 주세요.\n${deployed.out.slice(-400)}`);

// 5. Health check
step(5, '연결 확인');
let healthy = false;
for (let i = 0; i < 12 && !healthy; i++) {
  try { healthy = (await fetch(`${SITE}/api/spaces/${SPACE}/universe`, {cache: 'no-store'})).ok; } catch {}
  if (!healthy) await new Promise(r => setTimeout(r, 5000));
}
cleanup();
if (!healthy) fail(`배포는 끝났지만 ${SITE}/api/spaces/${SPACE}/universe 가 아직 응답하지 않아요. 1분 뒤 다시 열어 보세요.`);

say('\n완료! MOONS가 연결됐어요.');
say(`  큰 화면:   ${SITE}/universe`);
say(`  QR 질문:   ${SITE}/now`);
say(`  관리 화면: ${SITE}/admin`);
if (adminToken) say(`\n관리 화면 토큰 (지금 복사해 두세요, 다시 보여드릴 수 없어요):\n  ${adminToken}`);
