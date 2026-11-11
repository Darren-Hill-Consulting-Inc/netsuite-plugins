/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/record', 'N/runtime'], (record, runtime) => {
  const post = (body) => {
    const rec = record.create({ type: 'customrecord_acme_release' });
    rec.setValue({ fieldId: 'custrecord_acme_release_version', value: body.version });
    rec.setValue({ fieldId: 'custrecord_acme_release_pipeline', value: body.pipeline });
    rec.setValue({ fieldId: 'custrecord_acme_release_user', value: runtime.getCurrentUser().id });
    return { id: rec.save() };
  };
  return { post };
});
