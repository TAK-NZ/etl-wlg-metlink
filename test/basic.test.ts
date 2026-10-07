import test from 'node:test';
import assert from 'node:assert';
import { SchemaType, DataFlowType, InvocationType, StaticCapabilities, PERMISSIONS } from '@tak-ps/etl';

// task.ts calls Task.init() at module scope which requires an ETL environment,
// so these must be set before the dynamic import below
process.env.ETL_API = process.env.ETL_API || 'http://localhost:5001';
process.env.ETL_LAYER = process.env.ETL_LAYER || '1';
process.env.ETL_TOKEN = process.env.ETL_TOKEN || 'etl.test-token';

const { default: Task } = await import('../task.js');

test('Task static config', () => {
    assert.equal(Task.name, 'etl-wlg-metlink');
    assert.deepEqual(Task.flow, [DataFlowType.Incoming]);
    assert.deepEqual(Task.invocation, [InvocationType.Schedule]);
});

test('Incoming Input schema', async () => {
    const task = await Task.init();
    const schema = await task.schema(SchemaType.Input, DataFlowType.Incoming);

    assert.equal(schema.type, 'object');
    for (const key of [
        'METLINK_API_KEY',
        'Show_Buses',
        'Show_Trains',
        'Show_Ships',
        'DEBUG'
    ]) {
        assert.ok(schema.properties[key], `Env schema missing property: ${key}`);
    }

    assert.equal(schema.properties.METLINK_API_KEY.type, 'string');
    assert.equal(schema.properties.METLINK_API_KEY.default, '');
    for (const key of ['Show_Buses', 'Show_Trains', 'Show_Ships']) {
        assert.equal(schema.properties[key].type, 'boolean');
        assert.equal(schema.properties[key].default, true);
    }
    assert.equal(schema.properties.DEBUG.type, 'boolean');
    assert.equal(schema.properties.DEBUG.default, false);
});

test('Incoming Output schema', async () => {
    const task = await Task.init();
    const schema = await task.schema(SchemaType.Output, DataFlowType.Incoming);

    assert.equal(schema.type, 'object');
    for (const key of ['id', 'vehicle']) {
        assert.ok(schema.properties[key], `Output schema missing property: ${key}`);
    }
    for (const key of ['trip', 'position', 'timestamp', 'vehicle']) {
        assert.ok(schema.properties.vehicle.properties[key], `Output schema missing vehicle property: ${key}`);
    }
});

test('Outgoing flow is not provided', async () => {
    const task = await Task.init();
    const schema = await task.schema(SchemaType.Input, DataFlowType.Outgoing);

    assert.deepEqual(schema.properties, {});
});

test('capabilities.json is a valid manifest matching the task', async () => {
    const doc = await StaticCapabilities.read(new URL('../capabilities.json', import.meta.url).pathname);

    assert.equal(doc.name, 'Wellington Metlink');
    assert.ok(doc.permissions.length > 0);

    for (const permission of doc.permissions) {
        // Resources are expressed as <permission>:<level>, where <level> may be a wildcard
        const [name, level] = permission.resource.split(':');
        assert.ok(PERMISSIONS[name], `Unknown permission: ${permission.resource}`);
        assert.ok(level === '*' || PERMISSIONS[name].includes(level), `Unknown permission level: ${permission.resource}`);
    }

    assert.equal(doc.invocations.incoming?.schedule?.default.schedule, 'rate(1 minute)');
});
