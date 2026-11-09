import { useContext, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { SiteContext } from '../../app/providers/site-provider';
import type { SiteSettings } from '../../entities/site/model/types';
import { contentApi } from '../../features/content/api/content-api';
import { errorMessage } from '../../shared/format';
import { useAdminDirtyState, useAdminUi } from './AdminUi';

type Field = { key: keyof SiteSettings; label: string; type?: 'url' | 'email'; multiline?: boolean; hint?: string; placeholder?: string };
const SECTIONS: Array<{ id: string; title: string; description: string; fields: Field[] }> = [
  { id: 'site', title: '站点信息', description: '出现在页眉、首页和浏览器标题中。', fields: [
    { key: 'site_title', label: '站点名称' },
    { key: 'site_description', label: '一句话介绍', hint: '首页大标题下方的那句话。' },
    { key: 'hero_kicker', label: '首页眉题', placeholder: 'A quiet corner on the internet' },
    { key: 'footer_text', label: '页脚文字' },
    { key: 'icp_number', label: '备案号', placeholder: '例如：京ICP备xxxxxxxx号' },
  ] },
  { id: 'contact', title: '联系方式', description: '页脚与「关于」页展示的链接。', fields: [
    { key: 'email', label: '邮箱', type: 'email' },
    { key: 'github_handle', label: 'GitHub 昵称' },
    { key: 'github_url', label: 'GitHub 链接', type: 'url' },
    { key: 'wechat_handle', label: '公众号名称' },
    { key: 'wechat_url', label: '公众号链接', type: 'url' },
    { key: 'douyin_handle', label: '抖音昵称' },
    { key: 'douyin_url', label: '抖音链接', type: 'url' },
    { key: 'xiaohongshu_handle', label: '小红书昵称' },
    { key: 'xiaohongshu_url', label: '小红书链接', type: 'url' },
  ] },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>();
  const [mottoText, setMottoText] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useAdminUi();
  const { applySettings } = useContext(SiteContext);
  const merged = settings ? { ...settings, mottos: mottoText.split('\n').map((line) => line.trim()).filter(Boolean) } : undefined;
  const dirty = Boolean(merged) && JSON.stringify(merged) !== saved;
  useAdminDirtyState(dirty);

  useEffect(() => {
    contentApi.getSettings()
      .then((value) => { setSettings(value); setMottoText(value.mottos.join('\n')); setSaved(JSON.stringify(value)); })
      .catch((err) => setError(errorMessage(err, '设置加载失败')));
  }, []);

  async function save() {
    if (!merged) return;
    setSaving(true);
    try {
      const result = await contentApi.saveSettings(merged);
      setSettings(result);
      setMottoText(result.mottos.join('\n'));
      setSaved(JSON.stringify(result));
      applySettings(result);
      notify('站点设置已保存');
    } catch (err) {
      notify(errorMessage(err, '设置保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (dirty) void save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) return <div className="admin-page"><div className="notice error">{error}</div></div>;
  if (!settings) return <div className="admin-page"><p className="panel-empty">正在加载设置…</p></div>;

  return (
    <div className="admin-page settings-page">
      <header className="page-header">
        <div><h1>站点设置</h1><p>全站共用的信息。作品集与「关于」页的个人介绍在「作品集」中编辑。</p></div>
        <button type="button" className="button primary" onClick={() => void save()} disabled={!dirty || saving}><Save aria-hidden="true" />{saving ? '保存中…' : dirty ? '保存' : '已保存'}</button>
      </header>
      {SECTIONS.map((section) => (
        <section className="settings-block" key={section.id}>
          <header><h2>{section.title}</h2><p>{section.description}</p></header>
          <div className="settings-fields">
            {section.fields.map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <input className="input" type={field.type ?? 'text'} value={String(settings[field.key] ?? '')} placeholder={field.placeholder} onChange={(event) => setSettings({ ...settings, [field.key]: event.target.value })} />
                {field.hint ? <small>{field.hint}</small> : null}
              </label>
            ))}
          </div>
        </section>
      ))}
      <section className="settings-block">
        <header><h2>首页座右铭</h2><p>每行一句，首页随机展示一句，访客可以点「换一句」。当前 {merged?.mottos.length ?? 0} 句。</p></header>
        <div className="settings-fields single">
          <textarea className="textarea motto-input" rows={Math.min(18, Math.max(6, mottoText.split('\n').length + 1))} value={mottoText} onChange={(event) => setMottoText(event.target.value)} placeholder={'慢慢来，比较快。\n每行一句…'} />
        </div>
      </section>
    </div>
  );
}
