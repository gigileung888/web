(function () {
  const defaultContent = window.GOLDEN_HOLIDAY_CONTENT;
  const defaultMedia = window.GOLDEN_HOLIDAY_MEDIA || {};
  const languageStorageKey = 'goldenHolidayLanguage';
  const cmsStorageKey = 'goldenHolidayCmsDraft';
  const languages = ['zh', 'en'];
  const languageNames = { zh: '中文', en: 'English' };
  const mediaLabels = {
    logo: '品牌 Logo',
    hero: '首屏大图',
    heroCard: '首屏路线卡片图',
    showcase1: '体验展示图 1',
    showcase2: '体验展示图 2',
    showcase3: '体验展示图 3'
  };

  if (!defaultContent) return;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  const mergeDeep = (base, override) => {
    if (Array.isArray(base)) {
      return base.map((item, index) => mergeDeep(item, override?.[index]));
    }
    if (isObject(base)) {
      return Object.keys(base).reduce((result, key) => {
        result[key] = mergeDeep(base[key], override?.[key]);
        return result;
      }, {});
    }
    return override === undefined ? base : override;
  };

  const getValue = (source, path) => path.split('.').reduce((value, part) => value?.[part], source);

  const setValue = (source, path, value) => {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((object, part) => object?.[part], source);
    if (target && last) target[last] = value;
  };

  const readDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(cmsStorageKey)) || {};
    } catch {
      return {};
    }
  };

  let draft = readDraft();
  let content = mergeDeep(defaultContent, draft.content);
  let media = { ...defaultMedia, ...(draft.media || {}) };

  const getInitialLanguage = () => {
    const saved = localStorage.getItem(languageStorageKey);
    if (languages.includes(saved)) return saved;
    return navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  };

  const saveDraft = () => {
    localStorage.setItem(cmsStorageKey, JSON.stringify({ content, media, updatedAt: new Date().toISOString() }));
  };

  const applyMedia = () => {
    document.querySelectorAll('[data-media]').forEach((element) => {
      const key = element.dataset.media;
      if (media[key]) element.setAttribute('src', media[key]);
    });

    if (media.hero) document.documentElement.style.setProperty('--hero-image', `url("${media.hero}")`);
    if (media.heroCard) document.documentElement.style.setProperty('--hero-card-image', `url("${media.heroCard}")`);
  };

  const renderLanguage = (language) => {
    const copy = content[language] || content.zh;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = getValue(copy, element.dataset.i18n);
      if (value !== undefined) element.textContent = value;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach((element) => {
      element.dataset.i18nAttr.split(',').forEach((pair) => {
        const [attribute, key] = pair.split(':').map((item) => item.trim());
        const value = getValue(copy, key);
        if (attribute && value !== undefined) element.setAttribute(attribute, value);
      });
    });

    const current = document.querySelector('[data-lang-current]');
    const next = document.querySelector('[data-lang-next]');
    const toggle = document.querySelector('[data-lang-toggle]');
    if (current) current.textContent = copy.language.current;
    if (next) next.textContent = copy.language.next;
    if (toggle) toggle.dataset.language = language;

    document.title = copy.meta.title;
    localStorage.setItem(languageStorageKey, language);
    applyMedia();
  };

  const currentLanguage = () => localStorage.getItem(languageStorageKey) || getInitialLanguage();

  const toggleLanguage = () => {
    renderLanguage(currentLanguage() === 'zh' ? 'en' : 'zh');
  };

  const collectEditableFields = (source, prefix = '') => {
    if (typeof source === 'string') return [{ path: prefix, value: source }];
    if (Array.isArray(source)) {
      return source.flatMap((item, index) => collectEditableFields(item, `${prefix}.${index}`.replace(/^\./, '')));
    }
    if (isObject(source)) {
      return Object.entries(source).flatMap(([key, value]) => collectEditableFields(value, `${prefix}.${key}`.replace(/^\./, '')));
    }
    return [];
  };

  const prettifyPath = (path) => path
    .replace(/\.(\d+)\./g, ' #$1 · ')
    .replace(/\.(\d+)$/g, ' #$1')
    .replace(/\./g, ' · ')
    .replace(/\bmeta\b/g, 'SEO')
    .replace(/\bhero\b/g, '首屏')
    .replace(/\bintro\b/g, '简介')
    .replace(/\bshowcase\b/g, '展示')
    .replace(/\broutes\b/g, '路线')
    .replace(/\bservices\b/g, '服务')
    .replace(/\bprocess\b/g, '流程')
    .replace(/\bcontact\b/g, '联系')
    .replace(/\bfooter\b/g, '页脚')
    .replace(/\btitle\b/g, '标题')
    .replace(/\btext\b/g, '正文')
    .replace(/\blabel\b/g, '标签')
    .replace(/\bcta\b/g, '按钮')
    .replace(/\balt\b/g, '图片描述')
    .replace(/\baria\b/g, '无障碍说明');

  const fieldControl = ({ path, value }, language) => {
    const label = document.createElement('label');
    label.className = 'cms-field';

    const name = document.createElement('span');
    name.textContent = prettifyPath(path);
    label.append(name);

    const input = value.length > 72 ? document.createElement('textarea') : document.createElement('input');
    input.value = value;
    input.dataset.path = path;
    if (input.tagName === 'TEXTAREA') input.rows = Math.min(5, Math.max(2, Math.ceil(value.length / 52)));
    input.addEventListener('input', () => {
      setValue(content[language], path, input.value);
      renderLanguage(currentLanguage());
    });
    label.append(input);
    return label;
  };

  const mediaControl = (key) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cms-media-field';

    const preview = document.createElement('img');
    preview.src = media[key];
    preview.alt = `${mediaLabels[key] || key} preview`;
    wrapper.append(preview);

    const controls = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'cms-field';
    label.innerHTML = `<span>${mediaLabels[key] || key}</span>`;

    const input = document.createElement('input');
    input.value = media[key] || '';
    input.placeholder = '图片 URL / assets/xxx.png / data:image...';
    input.addEventListener('input', () => {
      media[key] = input.value.trim();
      preview.src = media[key];
      applyMedia();
    });
    label.append(input);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'cms-file-input';
    file.addEventListener('change', () => {
      const selected = file.files?.[0];
      if (!selected) return;
      const reader = new FileReader();
      reader.onload = () => {
        media[key] = reader.result;
        input.value = media[key];
        preview.src = media[key];
        applyMedia();
      };
      reader.readAsDataURL(selected);
    });

    controls.append(label, file);
    wrapper.append(controls);
    return wrapper;
  };

  const renderCmsFields = (panel) => {
    const selectedLanguage = panel.querySelector('[data-cms-language]').value;
    const textFields = panel.querySelector('[data-cms-text-fields]');
    const mediaFields = panel.querySelector('[data-cms-media-fields]');
    textFields.innerHTML = '';
    mediaFields.innerHTML = '';

    collectEditableFields(content[selectedLanguage]).forEach((field) => textFields.append(fieldControl(field, selectedLanguage)));
    Object.keys(mediaLabels).forEach((key) => mediaFields.append(mediaControl(key)));
  };

  const exportDraft = () => {
    const blob = new Blob([JSON.stringify({ content, media }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `golden-holiday-content-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importDraft = (file, panel) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported.content || !imported.media) throw new Error('Invalid file');
        content = mergeDeep(defaultContent, imported.content);
        media = { ...defaultMedia, ...imported.media };
        saveDraft();
        renderLanguage(currentLanguage());
        renderCmsFields(panel);
        panel.querySelector('[data-cms-status]').textContent = '已导入并应用。';
      } catch {
        panel.querySelector('[data-cms-status]').textContent = '导入失败，请选择正确的 JSON 文件。';
      }
    };
    reader.readAsText(file);
  };

  const shouldEnableCms = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === '1' || window.location.hash === '#admin';
  };

  const buildCms = () => {
    if (!shouldEnableCms() || document.querySelector('.cms-launcher')) return;

    const launcher = document.createElement('button');
    launcher.className = 'cms-launcher';
    launcher.type = 'button';
    launcher.textContent = '内容管理';

    const panel = document.createElement('aside');
    panel.className = 'cms-panel';
    panel.setAttribute('aria-label', '内容管理系统');
    panel.innerHTML = `
      <div class="cms-header">
        <div>
          <span>Golden Holiday CRM</span>
          <h2>内容管理系统</h2>
          <p>编辑文字与图片，保存到当前浏览器。上线前可导出 JSON 交给开发替换默认内容。</p>
        </div>
        <button type="button" class="cms-close" data-cms-close aria-label="关闭内容管理系统">×</button>
      </div>
      <div class="cms-toolbar">
        <label>编辑语言
          <select data-cms-language>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <button type="button" data-cms-save>保存</button>
        <button type="button" data-cms-export>导出 JSON</button>
        <label class="cms-import">导入 JSON<input type="file" accept="application/json" data-cms-import></label>
        <button type="button" data-cms-reset>恢复默认</button>
      </div>
      <p class="cms-status" data-cms-status>未保存的修改会实时预览。</p>
      <details open>
        <summary>文字内容</summary>
        <div class="cms-fields" data-cms-text-fields></div>
      </details>
      <details open>
        <summary>图片素材</summary>
        <div class="cms-media-fields" data-cms-media-fields></div>
      </details>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'cms-overlay';

    const openPanel = () => {
      panel.classList.add('is-open');
      overlay.classList.add('is-open');
      renderCmsFields(panel);
    };
    const closePanel = () => {
      panel.classList.remove('is-open');
      overlay.classList.remove('is-open');
    };

    launcher.addEventListener('click', openPanel);
    overlay.addEventListener('click', closePanel);
    panel.querySelector('[data-cms-close]').addEventListener('click', closePanel);
    panel.querySelector('[data-cms-language]').addEventListener('change', () => renderCmsFields(panel));
    panel.querySelector('[data-cms-save]').addEventListener('click', () => {
      saveDraft();
      panel.querySelector('[data-cms-status]').textContent = '已保存到当前浏览器。';
    });
    panel.querySelector('[data-cms-export]').addEventListener('click', exportDraft);
    panel.querySelector('[data-cms-import]').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) importDraft(file, panel);
      event.target.value = '';
    });
    panel.querySelector('[data-cms-reset]').addEventListener('click', () => {
      if (!confirm('确认恢复默认内容？这会清除当前浏览器中保存的修改。')) return;
      localStorage.removeItem(cmsStorageKey);
      draft = {};
      content = clone(defaultContent);
      media = { ...defaultMedia };
      renderLanguage(currentLanguage());
      renderCmsFields(panel);
      panel.querySelector('[data-cms-status]').textContent = '已恢复默认内容。';
    });

    document.body.append(launcher, overlay, panel);
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderLanguage(getInitialLanguage());
    buildCms();
    document.querySelector('[data-lang-toggle]')?.addEventListener('click', toggleLanguage);
  });
})();
