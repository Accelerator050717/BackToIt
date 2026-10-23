# BackToIt v0.1 implementation plan

The empty, user-selected workspace is used directly. No Git repository existed. No commit, publication, telemetry, account, or remote service is required.

1. Build a WXT MV3 extension with shared React side panel and full extension page.
2. Use transactional Dexie commands, revisions, immutable checkpoints, and one current-task pointer.
3. Capture only explicit saves, enforce activeTab and URL safety, and preserve pending captures.
4. Implement local recovery rules and opt-in loopback-only Ollama requests.
5. Verify unit/integration tests and an installed build in isolated Playwright Chromium, visually inspect screenshots, then package and document evidence.

## Design decision

Palette: paper #f7fafc, mist #eaf1f7, ink #20364a, secondary #556b7b, action #235ea7, line #d7e2eb. Use local system fonts (Segoe UI / Microsoft YaHei), readable 15–16px body, left-aligned text. A small reconnecting-line mark and one blue next-action region anchor the interface. The narrow side panel is the primary layout; a generous centered full page exposes task browsing and settings without a dashboard. Forms progressively expand. No remote assets.

## Shared implementation contract

Source code lives in src/. entrypoints/background.ts is the worker; entrypoints/sidepanel and entrypoints/app are React pages. Use native chrome.\* APIs and @types/chrome. Import paths may be relative. Storage exports repo and db from src/storage/repository.ts; all persistent mutations use repo. UI imports types from src/domain/types.ts.

Task: id,title,status(active|paused|completed|archived),progress,blocker,nextStep,primaryResourceId(nullable),createdAt,updatedAt,revision,isExample. Resource: id,taskId,title,url(nullable),excerpts(string[]),note,source(page|selection|manual),savedAt,revision. Checkpoint: id,taskId,progress,blocker,nextStep,resourceIds,createdAt. ParkingItem: id,text,done,createdAt,updatedAt. AppSnapshot: tasks,resources,checkpoints,parking,currentTaskId(nullable).

Repository methods (all async): getState(); createTask(title,nextStep?,isExample?); updateTask(id,patch,expectedRevision); activateTask(id); checkpointTask(id,fields,expectedRevision); setTaskStatus(id,status); deleteTask(id); addResource(taskId,input)->{resource,undoId}; undoResource(undoId); updateResource(id,{note?,title?},expectedRevision); removeResource(id); setPrimaryResource(taskId,resourceId|null); deleteCheckpoint(id); addParking(text); updateParking(id,{text?,done?}); deleteParking(id); parkingToTask(id); exportBackup(); importBackup(validatedBackup); clearExamples(); clearAll(); createExample(). Methods return entity where useful. updateTask patch allows title,progress,blocker,nextStep. checkpointTask saves fields + references and pauses atomically. addResource input has title,url(string|null),excerpt?,note?,source. undo must not clobber subsequent edits. Conflict errors have code CONFLICT. All meaningful resource edits bump task revision to expire AI suggestions. db liveQuery supplies cross-context refresh.

src/domain/backup.ts exports parseBackup(text): Backup plus toMarkdown(task,resources,checkpoints): string. Limit 5 MiB input, 500 tasks, 5000 resources, 5000 checkpoints, 2000 parking items. Backup content excludes configuration. Import remaps IDs, imports tasks paused except completed/archived, preserves references, and never changes existing current task. Strict schemas reject unknown properties.

src/domain/url.ts exports inspectUrl(raw): {url:string,sensitive:boolean,safeUrl:string,removedTracking:boolean}; only http(s), strip embedded credentials and known tracking parameters, preserve nontracking params and hash. Suspected credential/signature query warns; explicit UI choice saves safeUrl or original sanitized url.

Browser API in src/browser/adapter.ts: captureCurrentPage(): Promise<CaptureDraft>; openResources(resources:Resource[]): Promise<void>; getPendingCapture():Promise<CaptureDraft|null>; clearPendingCapture():Promise<void>; openApp(section?:string):Promise<void>. CaptureDraft {title,url,excerpt?,source,truncated?,error?}. Capture/current context menus NEVER save risky links without explicit confirmation. Pending capture in storage.session. Incoming messages Zod-validated and sender restricted to extension pages. Browser save feedback only after repo commit; worker session feedback can be surfaced in UI. Context-menu event uses immediate sidePanel.open before awaits, errors caught.

src/ai/providers.ts: LocalRulesProvider.generate(task,resources,language): RecoveryCard synchronous, and OllamaProvider with testConnection(config,signal?) returning string[] installed local model names, generate(input,config,signal?) returning Suggestion. exports buildAIInput(task,resources,language), validateSuggestion(raw,input), isSuggestionStale(suggestion,task), AIInput and Suggestion. RecoveryCard {progress,blocker,nextStep,isSuggestion,resourceIds}; Suggestion {recap,suggestedNextStep,resourceIds,sourceIds,taskId,revision}. config {enabled,endpoint:'http://localhost:11434'|'http://127.0.0.1:11434',model}. No URL in AI input; limits and JSON schema in provider; sourceIds refer to task id or resource ids.

src/browser/settings.ts: settings defaults {language:'zh-CN',appearance:'light',ollama:{enabled:false,endpoint:'http://127.0.0.1:11434',model:''}}; getSettings(), updateSettings(patch), enableOllama(endpoint):Promise<boolean> (permission request directly in click handler), disableOllama():Promise<void> removes grants. UI can chrome.storage.onChanged for updates. Appearance light/system. getSettings must not connect to model.

Owner boundaries: data agent owns src/domain/{schemas,url,backup}.ts, src/storage/** and tests/storage*, tests/domain*. Browser agent owns src/browser/**, src/ai/**, entrypoints/background.ts and tests/browser*, tests/ai*. UI agent owns src/ui/** and entrypoints/{sidepanel,app}/\*_ plus tests/ui_. Root owns config/package/scripts/e2e/docs/assets and integration fixes.
