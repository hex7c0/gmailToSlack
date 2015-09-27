/*
 * config
 */
var uri = 'https://hooks.slack.com/services/WB_1/WB_2';
var email = Session.getActiveUser().getEmail(); // grab user data email
var channel = '@' + email.match(/^[^@]*/i)[0];
var isSlack = /@slack.com/;

/**
 * runs when the add-on is installed calls onOpen() to ensure menu creation and any other initializion work is done immediately
 * 
 * @param {Object} e The event parameter for a simple onInstall trigger
 * @return {Null}
 */
function onInstall() {

  ScriptApp.newTrigger('getGmailUnreaded').timeBased().everyMinutes(5).create();
  return;
}

/**
 * grab unread emails. Send notification to slack and prevent to resend same email, if already done
 * 
 * @customfunction
 * @param {Object} e the event parameter for this trigger
 * @return {Null}
 */
function getGmailUnreaded(e) {

  if (GmailApp.getInboxUnreadCount() === 0) { // prenvent gmail search
    return;
  }

  var threads = GmailApp.search('in:inbox label:unread'); // search in inbox, unread emails
  for (var i = 0, ii = threads.length; i < ii; ++i) {
    var thread = threads[i];

    var id = thread.getId();
    var permalink = thread.getPermalink();
    var date = thread.getLastMessageDate().toLocaleString();
    var messages = thread.getMessages(); // just first
    var lastMessage = messages[messages.length - 1];
    var from = lastMessage.getFrom();
    var subject = lastMessage.getSubject();

    var previousSend = PropertiesService.getUserProperties().getProperty(id);
    if (previousSend && previousSend == date) { // already done, but unread
      continue;
    } else if (isSlack.test(from) === true) { // prevent slack loop
      continue;
    }

    var data = {
      channel: channel,
      username: 'Gmail',
      fallback: date + ' new unread email (' + subject + ') from "' + from
        + '" in <' + permalink + '|inbox>',
      color: 'good', // can either be one of 'good', 'warning', 'danger', or any hex color code
      fields: [ {
        title: date + ' - ' + subject, // the title may not contain markup and will be escaped for you
        value: 'new unread email from "' + from + '" in <' + permalink
          + '|inbox>',
        short: false, // optional flag indicating whether the `value` is short enough to be displayed side-by-side with other values
      } ]
    };

    var lock = LockService.getScriptLock();
    lock.waitLock(10000); // 10 sec wait for lock
    sendHttpPost(data);
    PropertiesService.getUserProperties().setProperty(id, date); // stop another loop
    lock.releaseLock(); // go ahead
  }

  return;
}

/**
 * send POST request to slack webhook. Throw error if not 200
 * 
 * @customfunction
 * @param {Object} model data
 * @return {String}
 */
function sendHttpPost(model) {

  Logger.log(model); // input

  var options = {
    method: 'post',
    payload: JSON.stringify(model),
    contentType: 'application/json'
  };
  var response = UrlFetchApp.fetch(uri, options).getContentText(); // throw error if not 200

  Logger.log(response); // ok

  return response;
}
