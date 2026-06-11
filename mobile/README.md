# Razorfy Mobile

Aplicativo cliente da Razorfy, construído com Expo, React Native e TypeScript.

## Funcionalidades

- cadastro e login com sessão JWT no Secure Store;
- painel inicial com próximo horário, cashback e catálogo;
- agendamento de múltiplos serviços;
- seleção de barbeiro, data e horários dinâmicos;
- checkout com cashback, PIX ou pagamento presencial;
- cópia do código PIX e confirmação simulada apenas em desenvolvimento;
- consulta e cancelamento de agendamentos;
- carteira e extrato de cashback;
- perfil e logout seguro.

## Requisitos

- Node.js compatível com Expo SDK 56;
- backend e PostgreSQL em execução;
- Expo Go no aparelho ou Android Studio com emulador.

## Configuração

```powershell
cd mobile
Copy-Item .env.example .env
npm install
```

No emulador Android, o endereço padrão é:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api/v1
```

No simulador iOS, use `http://localhost:8080/api/v1`.

Em um aparelho físico, substitua pelo IP local do computador:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.0.10:8080/api/v1
```

O computador e o celular devem estar na mesma rede. A porta `8080` precisa estar acessível no
firewall local.

## Executar

Inicie a infraestrutura na raiz do repositório:

```powershell
docker compose up --build postgres backend
```

Depois inicie o aplicativo:

```powershell
cd mobile
npm start
```

- pressione `a` para abrir o emulador Android;
- escaneie o QR Code com o Expo Go para usar um aparelho físico;
- execute `npm run web` para uma prévia no navegador.

## Validação

```powershell
npm run typecheck
npm run doctor
npx expo export --platform android --output-dir dist-android
```

## Build de distribuição

Os perfis estão definidos em `eas.json`. Após configurar a conta Expo:

```powershell
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform all --profile production
```

Credenciais de loja, assinatura e conta Expo não ficam versionadas.
