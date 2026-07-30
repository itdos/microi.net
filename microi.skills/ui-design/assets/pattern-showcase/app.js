(function () {
  'use strict';

  var root = document.documentElement;
  var themeToggle = document.getElementById('themeToggle');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-kind]'));
  var form = document.getElementById('flowForm');
  var nameInput = document.getElementById('workspaceName');
  var status = document.getElementById('formStatus');
  var submit = document.getElementById('flowSubmit');

  themeToggle.addEventListener('click', function () {
    var nextTheme = root.dataset.mciTheme === 'dark' ? 'light' : 'dark';
    root.dataset.mciTheme = nextTheme;
    themeToggle.setAttribute('aria-pressed', nextTheme === 'light' ? 'true' : 'false');
  });

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = button.dataset.filter;
      filterButtons.forEach(function (item) { item.classList.toggle('is-active', item === button); });
      cards.forEach(function (card) {
        var visible = filter === 'all' || card.dataset.kind === filter;
        card.classList.toggle('is-hidden', !visible);
      });
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var value = nameInput.value.trim();
    status.className = 'mci-flow-card__status';
    if (value.length < 2 || value.length > 24) {
      status.textContent = '请输入 2—24 个字符的空间名称。';
      status.classList.add('is-error');
      nameInput.focus();
      return;
    }

    submit.disabled = true;
    submit.classList.add('is-loading');
    submit.querySelector('span').textContent = '正在创建';
    status.textContent = '正在校验空间配置，请稍候…';

    window.setTimeout(function () {
      submit.disabled = false;
      submit.classList.remove('is-loading');
      submit.querySelector('span').textContent = '重新演示';
      status.textContent = '“' + value + '”已准备好，可以继续邀请成员。';
      status.classList.add('is-success');
    }, 760);
  });
}());
