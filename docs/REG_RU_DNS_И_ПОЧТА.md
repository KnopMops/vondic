# Настройка почты @vondic.ru: reg.ru, сервер и Docker

Пошаговая инструкция, чтобы **входящая и исходящая почта** на домене `vondic.ru` работала с **docker-mailserver** и клиентом Vondic.

---

## Что должно получиться

| Компонент | Значение |
|-----------|----------|
| Домен | `vondic.ru` (reg.ru) |
| Сайт (frontend) | **`vondic.ru`** — как сейчас, **не трогаем** |
| Почта | отдельное имя **`mail.vondic.ru`** (тот же публичный IP роутера) |
| MX | `vondic.ru` → `mail.vondic.ru` (не на корень сайта) |
| Адреса ящиков | `ivan@vondic.ru`, `noreply@vondic.ru` и т.д. |

**В reg.ru порты не указываются.** Только IP и имена. Порты настраиваются **на роутере** (проброс на LAN-сервер).

---

## Часть 0. NAT: домен → публичный IP роутера → сервер

Схема, если у вас уже так работает сайт:

```text
Интернет
    │
    ▼
[ Роутер ]  WAN = ПУБЛИЧНЫЙ_IP  (его вписываете в reg.ru)
    │
    │  Port Forward (проброс)
    ▼
[ Сервер в LAN ]  например 192.168.1.50
    ├── nginx :80, :443   → vondic.ru, api.vondic.ru (уже есть)
    └── mailserver :25, :587, :993 → mail.vondic.ru (добавить)
```

### 0.1. Какой IP писать в reg.ru

В **все** A-записи (`@`, `api`, `webrtc`, **`mail`**) — **один и тот же публичный IP роутера (WAN)**, не локальный `192.168.x.x`.

Как узнать WAN IP:

- Веб-интерфейс роутера → «Интернет» / «WAN» / «Внешний IP»
- Или с любого ПК в сети: открыть https://ifconfig.me — тот же IP, что уже стоит у `vondic.ru`

Обозначение в инструкции: **WAN_IP** (то же, что раньше называлось MAIL_IP).

> **CGNAT:** если WAN в роутере «серый» (10.x, 100.64.x) или провайдер не даёт белый IP — входящая почта с интернета **не дойдёт**. Нужен белый IP у провайдера или VPS только под почту.

### 0.2. Проброс портов на роутере (обязательно)

Зайдите в роутер: **Port Forwarding / Виртуальные серверы / NAT**.

**Внешний (WAN) порт = внутренний порт** на **LAN IP сервера** (у вас, например, `192.168.120.248`):

| Назначение | WAN (внешний) | → IP в LAN | LAN (внутренний) | Протокол |
|------------|---------------|------------|------------------|----------|
| Сайт HTTP | 80 | 192.168.120.248 | 80 | TCP |
| Сайт HTTPS | 443 | 192.168.120.248 | 443 | TCP |
| **Почта SMTP (входящие)** | **25** | 192.168.120.248 | **25** | TCP |
| **Почта submission** | **587** | 192.168.120.248 | **587** | TCP |
| Почта SMTPS (опционально) | 465 | 192.168.120.248 | 465 | TCP |
| **Почта IMAP** | **993** | 192.168.120.248 | **993** | TCP |

> **Docker bridge (172.17.x) — не для роутера.** Роутер шлёт на **IP хоста в Wi‑Fi/LAN** (`192.168.120.248`). Compose публикует порты на этот IP (`MAIL_BIND_IP` в `mail/.env`). Внутри Docker `mailserver` общается с `backend` по имени контейнера в сети `app-network` (bridge).

Минимум для работы: **25, 587, 993** + уже существующие **80, 443**.

- Имя правила в роутере может быть любым (`mail-smtp`, `vondic-imap`).
- **Не** пробрасывайте 25/587 на другой компьютер — только на тот же сервер, где Docker с `mailserver`.

Проверка с **внешней** сети (мобильный интернет, не Wi‑Fi дома):

```bash
nc -zv WAN_IP 25
nc -zv WAN_IP 587
nc -zv WAN_IP 993
```

Или: https://www.yougetsignal.com/tools/open-ports/ — IP = WAN_IP, порты 25, 587, 993.

### 0.3. Docker: `MAIL_BIND_IP` и bridge

В `mail/.env` (см. `mail/.env.example`):

```env
MAIL_BIND_IP=192.168.120.248
```

После `docker compose -f docker-compose.yml -f docker-compose.mail.yml up -d mailserver` на хосте должно слушать:

```bash
ss -lntp | grep -E ':25|:587|:993'
# 192.168.120.248:25, :587, :993
```

Проверка **из LAN** (другой ПК или телефон в Wi‑Fi):

```bash
nc -zv 192.168.120.248 25
nc -zv 192.168.120.248 587
nc -zv 192.168.120.248 993
```

Backend в том же compose обращается к почте как `mailserver:587` (внутри bridge), не через `192.168.120.248`.

### 0.4. Файрвол на самом сервере (после роутера)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 25/tcp
sudo ufw allow 587/tcp
sudo ufw allow 465/tcp
sudo ufw allow 993/tcp
```

Docker уже публикует эти порты из `docker-compose.mail.yml` на хост.

### 0.5. `vondic.ru` занят frontend — это нормально

| Имя | Роль | В reg.ru | На роутере |
|-----|------|----------|------------|
| `vondic.ru` | Сайт Vondic | A `@` → **WAN_IP** (уже есть) | 80, 443 |
| `api.vondic.ru` | API | A `api` → **WAN_IP** | 443 (через nginx) |
| **`mail.vondic.ru`** | **Только почта** | A `mail` → **тот же WAN_IP** | **25, 587, 993** |
| MX на `vondic.ru` | Куда слать письма `@vondic.ru` | MX → **`mail.vondic.ru`** | порт не в DNS, всегда 25 |

Сайт и почта на **одном IP**, различаются **именем** (SNI/TLS) и **портами**. Конфликта с frontend нет: веб не слушает 25/993.

### 0.6. PTR (обратная DNS) за NAT

В reg.ru PTR **не настраивается**. Нужно, чтобы **WAN_IP** при обратном lookup давал `mail.vondic.ru`:

- **Домашний провайдер:** звонок/чат в поддержку: «Настройте PTR для IP … на `mail.vondic.ru`». Часто отказывают на домашнем тарифе.
- **Белый IP на роутере:** иногда PTR уже есть на имя провайдера — тогда доставляемость хуже, но почта может работать.
- **VPS с белым IP:** PTR в панели хостера.

Проверка:

```bash
dig -x WAN_IP +short
```

---

## Часть 1. Подготовка сервера

### 1.1. Зафиксируйте WAN_IP и LAN IP сервера

На сервере:

```bash
curl -4 ifconfig.me   # должен совпасть с WAN роутера
hostname -I | awk '{print $1}'   # LAN, например 192.168.1.50
```

В DHCP роутера включите **резервацию** MAC сервера → тот же LAN IP, иначе проброс портов сломается.

### 1.2. Откройте порты в файрволе (если ещё не открыты)

```bash
sudo ufw allow 25/tcp
sudo ufw allow 587/tcp
sudo ufw allow 465/tcp
sudo ufw allow 993/tcp
# для Let's Encrypt на mail (если MAIL_SSL_TYPE=letsencrypt):
sudo ufw allow 80/tcp
```

У некоторых провайдеров порт **25 заблокирован** на WAN — уточните в поддержке ISP или проверьте `nc -zv WAN_IP 25` с мобильного интернета.

### 1.3. PTR

См. **п. 0.6** — для WAN_IP должно быть `mail.vondic.ru`. Без PTR письма чаще попадают в спам.

---

## Часть 2. DNS в reg.ru (полная таблица)

Войдите в [reg.ru](https://www.reg.ru/) → **Домены** → **vondic.ru** → **Управление зоной DNS** / **Ресурсные записи**.

Поддомен в reg.ru — поле **«Subdomain» / «Имя»**:
- корень сайта: `@` или пусто → `vondic.ru`
- почта: `mail` → `mail.vondic.ru`

**Во все A-записи подставляйте WAN_IP роутера** (тот же, что у работающего `vondic.ru`).

### 2.1. Запись A для почты (`mail.vondic.ru`)

| Тип | Имя (поддомен) | Значение | TTL |
|-----|----------------|----------|-----|
| **A** | `mail` | **WAN_IP** | 3600 |

Итог: `mail.vondic.ru` → роутер → проброс → сервер. **Не** используйте `vondic.ru` как имя почтового сервера в клиентах — только `mail.vondic.ru`.

Проверка:

```bash
dig mail.vondic.ru A +short
```

### 2.2. MX — куда доставлять входящую почту

| Тип | Имя | Значение | Приоритет | TTL |
|-----|-----|----------|-----------|-----|
| **MX** | `@` (или пусто / `vondic.ru`) | `mail.vondic.ru` | **10** | 3600 |

В reg.ru в поле «Субдомен» для корня часто ставят `@` или оставляют пустым — смотрите подсказку интерфейса.

Проверка:

```bash
dig vondic.ru MX +short
# 10 mail.vondic.ru.
```

### 2.3. SPF — кто может отправлять от имени домена

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| **TXT** | `@` | см. ниже | 3600 |

**Стартовая (мягкая) запись:**

```text
v=spf1 mx a:mail.vondic.ru ip4:WAN_IP ~all
```

Подставьте **WAN_IP** (публичный IP роутера). После стабильной работы можно ужесточить до `-all`:

```text
v=spf1 mx a:mail.vondic.ru ip4:WAN_IP -all
```

Проверка:

```bash
dig vondic.ru TXT +short
```

### 2.4. DKIM — подпись писем (после запуска mailserver)

DKIM генерируется **на сервере** после первого запуска контейнера:

```bash
docker exec mailserver setup config dkim domain vondic.ru
docker exec mailserver cat /tmp/docker-mailserver/opendkim/keys/vondic.ru/mail.txt
```

В выводе будет что-то вроде:

```text
mail._domainkey.vondic.ru. IN TXT "(v=DKIM1; k=rsa; p=MIIBIjAN...)"
```

В reg.ru добавьте **TXT**:

| Тип | Имя | Значение |
|-----|-----|----------|
| **TXT** | `mail._domainkey` | только строка в кавычках **без** имени домена: `v=DKIM1; k=rsa; p=...` (одна длинная строка или как показал setup) |

> Имя записи в reg.ru: `mail._domainkey`, не `mail._domainkey.vondic.ru` — панель сама допишет домен.

### 2.5. DMARC — политика для получателей

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@vondic.ru; pct=100` | 3600 |

Для начала можно `p=none`, через 2–4 недели — `quarantine` или `reject`.

### 2.6. Записи сайта (уже есть — только проверить IP)

| Тип | Имя в reg.ru | FQDN | Значение | Проброс на роутере |
|-----|--------------|------|----------|-------------------|
| A | `@` | `vondic.ru` | **WAN_IP** | 80, 443 |
| A | `api` | `api.vondic.ru` | **WAN_IP** | 443 |
| A | `webrtc` | `webrtc.vondic.ru` | **WAN_IP** | по вашей схеме |
| A | `mail` | `mail.vondic.ru` | **WAN_IP** | **25, 587, 993** |

Запись `@` **не удаляйте** — на ней сайт. Почта идёт через **`mail`** + **MX**.

### 2.7. Сводная таблица: что добавить/проверить в reg.ru

| № | Тип | Субдомен (имя) | Значение в reg.ru | Порт на роутере (не в DNS!) |
|---|-----|----------------|-------------------|----------------------------|
| 1 | A | `mail` | **WAN_IP** | 25, 587, 993 → сервер |
| 2 | MX | `@` | хост: `mail.vondic.ru`, приоритет **10** | 25 |
| 3 | TXT | `@` | `v=spf1 mx a:mail.vondic.ru ip4:WAN_IP ~all` | — |
| 4 | TXT | `mail._domainkey` | *(после DKIM на сервере)* | — |
| 5 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@vondic.ru` | — |

**Пример в интерфейсе reg.ru**

1. **Добавить A:** имя `mail`, тип A, значение `203.0.113.50` (ваш WAN_IP).
2. **Добавить MX:** имя `@`, тип MX, обменник `mail.vondic.ru`, приоритет `10`.
3. **Добавить TXT (SPF):** имя `@`, текст `v=spf1 mx a:mail.vondic.ru ip4:203.0.113.50 ~all`.
4. Сохранить зону, подождать 15–60 мин.

Порты **25 / 587 / 993 в reg.ru нигде не вводятся** — только проброс на роутере (часть 0.2).

### 2.8. TTL и ожидание

После сохранения подождите **15 мин – 48 ч** (зависит от TTL и кеша). Проверка с ПК:

```bash
dig vondic.ru MX +short
dig mail.vondic.ru A +short
dig vondic.ru TXT +short
dig mail._domainkey.vondic.ru TXT +short
```

Онлайн: [MXToolbox](https://mxtoolbox.com/SuperTool.aspx?action=mx%3avondic.ru).

---

## Часть 3. TLS-сертификат для mail.vondic.ru

В `mail/.env` по умолчанию `MAIL_SSL_TYPE=manual`.

### Вариант A — сертификат вручную (рекомендуется, если сайт уже на nginx)

Выпустите сертификат для `mail.vondic.ru` (Let's Encrypt на хосте или копия wildcard):

```bash
mkdir -p mail/config/ssl
# Пример: certbot certonly --standalone -d mail.vondic.ru
cp /etc/letsencrypt/live/mail.vondic.ru/fullchain.pem mail/config/ssl/mail.pem
cp /etc/letsencrypt/live/mail.vondic.ru/privkey.pem mail/config/ssl/key.pem
chmod 600 mail/config/ssl/key.pem
```

Имена файлов для docker-mailserver: **`mail.pem`** и **`key.pem`** в `mail/config/ssl/`.

### Вариант B — letsencrypt внутри контейнера

В `mail/.env`:

```env
MAIL_SSL_TYPE=letsencrypt
```

Нужен проброс **80/tcp** на сервер (WAN 80 → LAN 80) на время выпуска, либо используйте **вариант A** (certbot на хосте с nginx). Подробности: [документация DMS](https://docker-mailserver.github.io/docker-mailserver/latest/config/security/ssl/).

---

## Часть 4. Запуск Docker на сервере

В каталоге проекта Vondic:

```bash
cp mail/.env.example mail/.env
# отредактируйте mail/.env при необходимости

chmod +x mail/scripts/*.sh
./mail/scripts/init-mailserver.sh
```

Создайте системные ящики:

```bash
./mail/scripts/add-mailbox.sh noreply@vondic.ru 'СЛОЖНЫЙ_ПАРОЛЬ' 256
./mail/scripts/add-mailbox.sh postmaster@vondic.ru 'СЛОЖНЫЙ_ПАРОЛЬ' 512
```

Подключите к основному стеку:

```bash
docker compose -f docker-compose.yml -f docker-compose.mail.yml up -d
```

### Имя Docker-сети

Если backend не достучится до `mailserver`:

```bash
docker network ls | grep app-network
```

В `mail/.env` укажите точное имя, например:

```env
VONDIC_DOCKER_NETWORK=vondic_app-network
```

---

## Часть 5. Настройка backend Vondic

В `backend/.env.backend`:

```env
MAIL_SERVER=mailserver
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=noreply@vondic.ru
MAIL_PASSWORD=ПАРОЛЬ_ОТ_noreply
MAIL_DEFAULT_SENDER=noreply@vondic.ru

MAIL_DOMAIN=vondic.ru
MAIL_IMAP_HOST=mailserver
MAIL_IMAP_PORT=993
MAIL_IMAP_USE_TLS=True
MAIL_SMTP_INTERNAL_HOST=mailserver
MAIL_SMTP_INTERNAL_PORT=587

# Опционально отдельный ключ (Fernet): python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
MAIL_CREDENTIALS_KEY=

# 0 = ящики создаёте скриптом add-mailbox.sh; 1 = API вызывает docker exec (нужен docker на хосте)
MAIL_PROVISION_ENABLED=0
```

Перезапуск backend:

```bash
docker compose restart backend
```

---

## Часть 6. Ящики пользователей и Vondic

1. На сервере: `./mail/scripts/add-mailbox.sh ivan@vondic.ru 'пароль' 1024`
2. В Vondic: раздел **Почта** (`/feed/mail`) → создать ящик с тем же `local_part` (`ivan`) и паролем **или** API `POST /api/v1/mail/mailbox` с телом:

```json
{
  "local_part": "ivan",
  "password": "пароль_как_на_сервере",
  "display_name": "Иван"
}
```

Пароль в БД Vondic хранится **в зашифрованном виде** только для доступа API к IMAP/SMTP.

---

## Часть 7. Проверка, что всё работает

### 7.1. Порты

```bash
nc -zv mail.vondic.ru 25
nc -zv mail.vondic.ru 587
nc -zv mail.vondic.ru 993
```

### 7.2. Отправка с сервера

```bash
docker exec -it mailserver swaks \
  --to ВАШ@gmail.com \
  --from noreply@vondic.ru \
  --server 127.0.0.1:587 \
  --auth-user noreply@vondic.ru \
  --auth-password 'ПАРОЛЬ' \
  --tls
```

### 7.3. Thunderbird / Apple Mail

| Поле | Значение |
|------|----------|
| IMAP | `mail.vondic.ru`, порт **993**, SSL |
| SMTP | `mail.vondic.ru`, порт **587**, STARTTLS |
| Логин | полный адрес `user@vondic.ru` |

### 7.4. Vondic

Откройте https://vondic.ru/feed/mail — входящие, отправка.

---

## Часть 8. Типичные проблемы

| Симптом | Что проверить |
|---------|----------------|
| Письма не приходят | MX, A `mail`, проброс **25** на роутере, `docker logs mailserver` |
| Порты закрыты снаружи | Проброс WAN→LAN, ufw, CGNAT/нет белого IP |
| Сайт открывается, почта нет | Отдельно пробросьте 25/587/993, не только 443 |
| Письма в спам | PTR, SPF, DKIM, DMARC; [mail-tester.com](https://www.mail-tester.com/) |
| Ошибка SSL в клиенте | `mail/config/ssl/mail.pem` и `key.pem`, срок действия |
| Vondic: «Почтовый ящик не подключён» | Ящик создан в API/БД, пароль совпадает с mailserver |
| Vondic: 502 на /mail | `MAIL_IMAP_HOST=mailserver`, оба контейнера в одной сети |
| `setup email add` не работает | Контейнер `mailserver` запущен, имя в `docker ps` |
| Рег.ру не даёт MX | NS домена должны быть у reg.ru или добавьте MX у текущего DNS-провайдера |

---

## Часть 9. Безопасность и сопровождение

- Регулярно обновляйте образ: `docker compose -f docker-compose.mail.yml pull && docker compose ... up -d`
- Бэкап томов: `mail/data/mail-data`, `mail/data/mail-state`
- Не включайте `PERMIT_DOCKER=network` без необходимости (в compose уже **`none`** — только авторизованная отправка)
- Юридические документы: замените `vondic@mail.ru` на `postmaster@vondic.ru` или `support@vondic.ru`

---

## Часть 10. Чеклист перед продакшеном

- [ ] WAN_IP известен, в A-записях `@` и `mail` один и тот же  
- [ ] Роутер: проброс 25, 587, 993 → LAN IP сервера  
- [ ] A `mail` → WAN_IP (`mail.vondic.ru`)  
- [ ] MX `@` → `mail.vondic.ru` (10)  
- [ ] SPF TXT на `@` с `ip4:WAN_IP`  
- [ ] DKIM TXT `mail._domainkey`  
- [ ] DMARC TXT `_dmarc`  
- [ ] PTR WAN_IP → `mail.vondic.ru` (провайдер)  
- [ ] Снаружи открыты 25, 587, 993 на WAN_IP  
- [ ] TLS в `mail/config/ssl/`  
- [ ] `noreply@`, `postmaster@` созданы  
- [ ] `backend/.env.backend` указывает на `mailserver`  
- [ ] Тест mail-tester.com ≥ 8/10  
- [ ] Входящее/исходящее через Vondic `/feed/mail`  

---

См. также: `mail/README.md`, `docker-compose.mail.yml`.
