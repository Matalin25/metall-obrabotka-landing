/**
 * ============================================================================
 *  ЗАЯВКИ С САЙТА → GOOGLE ТАБЛИЦА
 *  Файл для вставки в: Таблица → Расширения → Apps Script → Code.gs
 * ============================================================================
 *
 *  УСТАНОВКА (один раз, ~3 минуты)
 *  ---------------------------------
 *  1. Откройте вашу таблицу заявок.
 *  2. Меню «Расширения» → «Apps Script».
 *  3. Удалите содержимое Code.gs и вставьте весь этот файл. Сохраните.
 *  4. Вверху нажмите «Развернуть» → «Новое веб-приложение»:
 *        Выполнять как:  Я  <-- обязательно (иначе скрипт не сможет писать в таблицу)
 *        Доступ:        Любой  <-- обязательно (иначе сайт не сможет отправлять)
 *     Нажмите «Развернуть» и при необходимости «Авторизовать доступ».
 *  5. Скопируйте ссылку, которая заканчивается на  /exec
 *        https://script.google.com/macros/s/AKfycbXXXXXXXX/exec
 *  6. Вставьте её в файл script.js сайта:
 *        var LEADS = { endpoint: 'https://script.google.com/macros/s/.../exec' }
 *  7. Обновите страницу сайта и отправьте тестовую заявку — строка появится в таблице.
 *
 *  ЕСЛИ ССЫЛКА НЕ РАБОТАЕТ
 *  -------------------------
 *  «Развернуть» → «Управление развёртываниями» → выбрать веб-приложение →
 *  «Изменить» → Тип: Веб-приложение → Доступ: Любой → «Обновить».
 *  Новую версию кода после каждого изменения нужно переразвернуть
 *  («Развернуть» → «Управление развёртываниями» → ✏️ → «Обновить»).
 *  Ссылки вида /exec (не /dev) работают всегда, в том числе с файловой страницы.
 *
 *  БАЗА ДОСТУПА К ТАБЛИЦЕ
 *  -----------------------
 *  Скрипт привязан к этой таблице, поэтому дополнительно открывать доступ
 *  никому не нужно. Если будете указывать SHEET_ID вручную — учтите,
 *  что аккаунт, под которым вы создали скрипт, должен иметь права на таблицу.
 * ============================================================================
 */

/* ID вашей таблицы (из адреса ссылки). Используется как запасной вариант. */
var SHEET_ID = '19JsLqVsX_j4bIsxcB02jV-9U5zNjUL_1eNwU-e3Pe7I';

/* Имя листа с заявками. Если листа нет — будет создан. */
var SHEET_NAME = 'Заявки';

/* Порядок колонок. Заполняется автоматически при первой заявке. */
var HEADERS = [
  'Дата и время',
  'Тип заявки',
  'Имя',
  'Телефон',
  'E-mail',
  'Тема / задача',
  'Комментарий',
  'Адрес доставки',
  'Сумма',
  'Позиции заказа',
  'Расчёт из калькулятора',
  'Страница',
  'UTM-метки',
  'Статус',
  'Менеджер'
];

/**
 * Приём заявки с сайта. Сайт шлёт POST с JSON в теле.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var raw = (e && e.postData && e.postData.contents) || '';
    var d = {};
    try {
      d = JSON.parse(raw);
    } catch (parseErr) {
      d = { message: 'не разобрано: ' + raw.slice(0, 400) };
    }

    var sheet = getSheet_();
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }

    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Europe/Moscow', 'dd.MM.yyyy HH:mm:ss'),
      d.type || '',
      d.name || '',
      d.phone || '',
      d.email || '',
      d.topic || '',
      d.message || '',
      d.address || '',
      d.total || '',
      d.items || '',
      d.calc || '',
      d.page || '',
      d.utm || '',
      'новая',
      ''
    ]);

    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService
      .createTextOutput('ERROR: ' + err)
      .setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}

/** Проверка ссылки: откройте /exec в браузере — должен появиться текст OK. */
function doGet() {
  return ContentService
    .createTextOutput('OK — приём заявок работает. Отправка идёт методом POST.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

/**
 * Разовая настройка: создать лист, заголовки, ширины колонок и уведомление на почту.
 * Запустите один раз вручную, потом функцию можно удалить.
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  var widths = [145, 150, 120, 130, 170, 230, 260, 200, 110, 320, 380, 220, 150, 100, 120];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }
  sheet.getRange('A:O').setVerticalAlignment('top');
  sheet.getRange('A:O').setWrap(true);

  try {
    var mail = Session.getActiveUser().getEmail() || 'ваш адрес';
    ScriptApp.newTrigger('onNewLeadEmail').forSpreadsheet(ss).onEdit().create();
    Logger.log('Готово. Уведомления на ' + mail);
  } catch (e) {
    Logger.log('Лист готов. Уведомление настроить не удалось: ' + e);
  }
}

/** Уведомление менеджеру о новой заявке (запускается триггером onEdit). */
function onNewLeadEmail(e) {
  if (!e || !e.range) return;
  if (e.range.getRow() < 2) return;
  if (e.range.getColumn() > 15) return;

  var mail = Session.getActiveUser().getEmail();
  if (!mail) return;

  var sheet = e.range.getSheet();
  var type = sheet.getRange(e.range.getRow(), 2).getValue();
  var name = sheet.getRange(e.range.getRow(), 3).getValue();
  var phone = sheet.getRange(e.range.getRow(), 4).getValue();

  MailApp.sendEmail({
    to: mail,
    subject: 'Новая заявка с сайта: ' + (type || 'без темы'),
    body:
      'Тип: ' + type + '\n' +
      'Имя: ' + name + '\n' +
      'Телефон: ' + phone + '\n\n' +
      'Ссылка на таблицу:\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    replyTo: mail
  });
}