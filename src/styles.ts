/** Scoped settings layout reusing DSH archive cards, theme tokens and preset creation affordance. */
export default `
.skm-page{container-type:inline-size;display:flex;flex-direction:column;gap:20px;max-width:760px;min-width:0;color:var(--dsw-alias-label-primary);font-size:13px}
.skm-header,.skm-group-header,.skm-name,.skm-actions,.skm-row-actions{display:flex;align-items:center;gap:8px}
.skm-header{justify-content:space-between}.skm-header h2{margin:0;font-size:18px;font-weight:500;line-height:28px}
.skm-search{width:100%;box-sizing:border-box}.skm-count{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}
.skm-toolbar{display:flex;align-items:center;gap:8px;min-width:0}.skm-toolbar>.skm-search{flex:1;min-width:0;width:auto}
.skm-filter{flex:0 0 160px;min-width:0}.skm-filter>button{width:100%;justify-content:space-between;gap:8px}.skm-filter-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.skm-group{display:flex;flex-direction:column;gap:10px}.skm-group+.skm-group{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:14px}
.skm-group-header{min-height:36px}.skm-group-header h3{margin:0;font-size:14px;font-weight:400;min-width:0}
.skm-group-toggle{display:flex;align-items:center;gap:8px;border:0;padding:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left;max-width:100%}.skm-group-toggle>span{min-width:0;overflow-wrap:anywhere}
.skm-group-toggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
.skm-group-toggle>svg{transform:rotate(-90deg);flex:none}.skm-group-toggle[aria-expanded=true]>svg{transform:none}
.skm-project-path{margin:-6px 0 0 20px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.skm-card{list-style:none;margin:0;padding:0 14px;border:0.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill)}
.skm-row{display:flex;align-items:center;gap:12px;padding:14px 0;min-width:0}.skm-row+.skm-row{border-top:0.5px solid var(--dsw-alias-border-l2)}
.skm-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.skm-name{flex-wrap:wrap;min-width:0}.skm-name>span:first-child{font-size:14px;font-weight:500;overflow-wrap:anywhere}
.skm-description{margin:0;line-height:20px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.skm-row-actions{flex:none;gap:4px}.skm-row-actions>[role=switch],.skm-row-actions>:last-child{margin-left:6px}.skm-delete:hover:not(:disabled){color:var(--dsw-alias-state-error-primary)}
.skm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:100px;color:var(--dsw-alias-label-secondary)}
.skm-custom{display:flex;flex-direction:column;gap:8px}.skm-custom h3{margin:0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.skm-create{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:8px 12px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);font:inherit;font-size:14px;line-height:22px;background:transparent;color:inherit;cursor:pointer}
.skm-create:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.skm-create:disabled{opacity:.4;cursor:default}.skm-create:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:3px}
.skm-notice{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}.skm-error,.skm-danger{color:var(--dsw-alias-state-error-primary)!important}
.skm-editor{width:min(760px,calc(100vw - 40px))!important}.skm-editor-content{display:flex;flex-direction:column;gap:12px}.skm-path{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);font-size:12px}
.skm-textarea{box-sizing:border-box;resize:vertical;width:100%;min-height:280px;max-height:45vh;padding:12px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-mono,monospace);font-size:13px;line-height:1.6}
.skm-textarea:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
@container(max-width:480px){.skm-row{gap:6px}.skm-card{padding-inline:10px}.skm-name{gap:5px}.skm-create{font-size:13px}.skm-filter{flex-basis:140px}}
@container(max-width:340px){.skm-toolbar{flex-wrap:wrap}.skm-toolbar>.skm-search,.skm-filter{flex-basis:100%}}
`
