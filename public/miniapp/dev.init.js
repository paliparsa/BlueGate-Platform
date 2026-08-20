// Dev helper to simulate Telegram WebApp environment for local testing
window.Telegram = window.Telegram || {};
window.Telegram.WebApp = window.Telegram.WebApp || {};
(function(w){
  const u = { id: 123456789, first_name: 'Dev', username: 'dev_user', photo_url: '' };
  w.WebApp.initData = 'dev_initdata';
  w.WebApp.initDataUnsafe = { user: u, start_param: '1' };
  w.WebApp.user = u;
  w.WebApp.platform = 'web';
  w.WebApp.ready = function(){ console.log('Telegram.WebApp.ready() (dev)'); };
  w.WebApp.expand = function(){ console.log('Telegram.WebApp.expand() (dev)'); };
  w.WebApp.disableVerticalSwipes = function(){};
  w.WebApp.HapticFeedback = { impactOccurred: function(){}, notificationOccurred: function(){} };
  w.WebApp.MainButton = { setParams: function(){}, show: function(){}, hide: function(){} };
})(window.Telegram);
console.info('Dev Telegram WebApp injected. Call load() if needed.');
