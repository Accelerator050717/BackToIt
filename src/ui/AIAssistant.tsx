import { useEffect, useRef, useState } from 'react';
import { WandSparkles } from 'lucide-react';
import type { Resource, Settings, Task } from '../domain/types';
import {
  buildAIInput,
  isSuggestionStale,
  OllamaProvider,
  type AIInput,
  type Suggestion,
} from '../ai/providers';
import { messageForError } from '../browser/errors';
import { useText } from './i18n';
import { Modal } from './primitives';
import type { Run } from './Resources';

export function AIAssistant({
  task,
  resources,
  settings,
  flush,
  onAdopt,
  run,
  contentDirty = false,
}: {
  task: Task;
  resources: Resource[];
  settings: Settings;
  flush: () => Promise<Task>;
  onAdopt: (next: string) => Promise<void>;
  run: Run;
  contentDirty?: boolean;
}) {
  const { t, language } = useText();
  const [preview, setPreview] = useState<AIInput | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const previousResourceIds = useRef(resources.map((resource) => resource.id));
  useEffect(
    () => () => {
      requestVersion.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!settings.ollama.enabled) {
      requestVersion.current++;
      controller.current?.abort();
      setPreview(null);
      setSuggestion(null);
      setBusy(false);
    }
  }, [settings.ollama.enabled]);
  useEffect(() => {
    const currentIds = resources.map((resource) => resource.id);
    if (previousResourceIds.current.some((id) => !currentIds.includes(id))) {
      requestVersion.current++;
      controller.current?.abort();
      setPreview(null);
      setSuggestion(null);
      setBusy(false);
      setError('');
    }
    previousResourceIds.current = currentIds;
  }, [resources.map((resource) => resource.id).join('|')]);
  const stale = suggestion ? contentDirty || isSuggestionStale(suggestion, task) : false;
  if (!settings.ollama.enabled) return null;
  return (
    <section className="ai-section">
      <button
        className="text-button"
        disabled={busy || !settings.ollama.model}
        onClick={() =>
          void run(async () => {
            const fresh = await flush();
            setPreview(buildAIInput(fresh, resources, language));
            setError('');
          })
        }
      >
        <WandSparkles size={16} />
        {t('帮我整理一下', 'Help me reconnect')}
      </button>
      {!settings.ollama.model && (
        <p className="tiny muted">
          {t('请先在设置中选择一个已安装的本地模型。', 'Choose an installed local model in settings first.')}
        </p>
      )}
      {error && (
        <p role="status" className="notice">
          {error}{' '}
          {t(
            '已继续使用本地规则，原始记录没有改变。',
            'Local rules remain available. Your original notes are unchanged.',
          )}
        </p>
      )}
      {suggestion && (
        <div className="ai-suggestion">
          <div className="section-title">
            <h3>{t('本地模型建议', 'Local model suggestion')}</h3>
            {stale && <span className="badge">{t('已过期', 'Outdated')}</span>}
          </div>
          <p>{suggestion.recap}</p>
          <p className="suggested-next">{suggestion.suggestedNextStep}</p>
          {suggestion.resourceIds.length > 0 && (
            <ul>
              {suggestion.resourceIds.map((id) => (
                <li key={id}>{resources.find((resource) => resource.id === id)?.title}</li>
              ))}
            </ul>
          )}
          <p className="tiny muted">
            {stale
              ? t(
                  '记录已改变，请重新整理后再采用。',
                  'Your saved content changed. Generate a fresh suggestion before adopting it.',
                )
              : t(
                  '这是一条建议；采用后才会更新你的下一步。',
                  'This is a suggestion. Your next step changes only when you adopt it.',
                )}
          </p>
          <button
            className="secondary"
            disabled={stale || busy}
            onClick={() =>
              void run(() => onAdopt(suggestion.suggestedNextStep), t('已更新下一步', 'Next step updated'))
            }
          >
            {t('采用这个下一步', 'Use this next step')}
          </button>
        </div>
      )}
      {preview && (
        <Modal
          title={t('确认要整理的内容', 'Review the content to organize')}
          onClose={() => {
            controller.current?.abort();
            setPreview(null);
          }}
          busy={false}
          wide
        >
          <p className="muted">
            {t(
              '仅发送下面的已保存内容至你启用的本机服务，不包含完整链接或暂存想法。',
              'Only the saved content below will go to your enabled local service. Full URLs and thoughts set aside are excluded.',
            )}
          </p>
          <InputPreview input={preview} />
          <p className="tiny muted">
            {t(
              '本机服务仍可能联网；请确认 Ollama Cloud 已关闭。',
              'Your local service may still access the internet. Confirm that Ollama Cloud is disabled.',
            )}
          </p>
          <div className="actions">
            {busy ? (
              <button className="secondary" onClick={() => controller.current?.abort()}>
                {t('取消整理', 'Cancel generation')}
              </button>
            ) : (
              <button className="secondary" onClick={() => setPreview(null)}>
                {t('返回', 'Back')}
              </button>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                controller.current = new AbortController();
                const version = ++requestVersion.current;
                try {
                  const result = await new OllamaProvider().generate(
                    preview,
                    settings.ollama,
                    controller.current.signal,
                  );
                  if (version === requestVersion.current) setSuggestion(result);
                } catch (caught) {
                  if (version === requestVersion.current) setError(messageForError(caught, language));
                } finally {
                  if (version === requestVersion.current) {
                    setBusy(false);
                    setPreview(null);
                    controller.current = null;
                  }
                }
              }}
            >
              {busy ? t('正在整理…', 'Organizing…') : t('发送并整理', 'Send and organize')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function InputPreview({ input }: { input: AIInput }) {
  const { t } = useText();
  return (
    <div className="input-preview">
      <h3>{input.task.title}</h3>
      <dl className="preview-fields">
        {[
          [t('进度', 'Progress'), input.task.progress],
          [t('卡点', 'Blocker'), input.task.blocker],
          [t('下一步', 'Next step'), input.task.nextStep],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || t('还没有记录', 'Nothing recorded yet')}</dd>
          </div>
        ))}
      </dl>
      <h3>{t('本次使用的资料', 'Resources included')}</h3>
      {input.resources.length ? (
        input.resources.map((resource) => (
          <article className="preview-resource" key={resource.id}>
            <h4>{resource.title}</h4>
            {resource.note && <p>{resource.note}</p>}
            {resource.excerpts.map((excerpt, index) => (
              <blockquote className="full-excerpt" key={index}>
                {excerpt}
              </blockquote>
            ))}
          </article>
        ))
      ) : (
        <p>{t('没有资料', 'No resources')}</p>
      )}
      <p className="tiny muted">
        {t(
          '这是实际发送的文字范围。最多使用 8 项资料，每项最多 2 段摘录；较长的文字会截短，链接会移除。',
          'This is the text that will be sent. Up to 8 resources and 2 excerpts each are included. Long fields are shortened and links are removed.',
        )}
      </p>
    </div>
  );
}
