Vue.component('wicked-api', {
    props: ['value', 'authMethods', 'groups', 'plans', 'envPrefix'],
    template: `
    <wicked-panel :open=true title="Basic Configuration" type="primary">
        <wicked-input v-model="value.id" :readonly=true label="API ID:" hint="The ID of the API; must only contain a-z, - and _." />
        <wicked-checkbox v-model="value.deprecated" label="<b>Deprecated</b>: Tick this to disable new subscriptions to your API. This is the first thing you should do when you want to phase out usage of an API. Second thing is to delete all subscriptions (in the running Portal, while the API is deprecated), then you can delete the API." />
        <wicked-input v-model="value.name" label="API Name:" hint="Friendly name of the API" :env-var="envPrefix + 'NAME'" />
        <wicked-input v-model="value.desc" label="Short Description:" hint="May contain markdown." :env-var="envPrefix + 'DESC'" />

        <hr>

        <div class="form-group">
            <label>Required User Group:</label>
            <p>Specify whether users need to belong to a specific user group to be able to see and use this API.</p>
            <select v-model="value.requiredGroup" class="form-control">
                <option value="">&lt;none&gt;</option>
                <option v-for="group in groups.groups" :value="group.id">{{ group.name }} ({{ group.id }})</option>
            </select>
        </div>

        <wicked-string-array :allow-empty=true v-model="value.tags" label="Tags:" />

        <div class="form-group">
            <label>Associated Plans:</label>
            <p>Each API has to be associated with at least one plan in order to enable subscriptions to the API. Select
               which plans shall be associated with this API.</p>
            <div v-for="plan in plans.plans">
                <input v-model="value.plans" type="checkbox" :id="'plan_' + plan.id" :value="plan.id" />
                <label :for="'plan_' + plan.id">{{ plan.name }} ({{ plan.id }})</label>
            </div>
        </div>
        
        <hr>

        <div class="form-group">
            <label>Authorization Mode:</label>
            <select v-model="value.auth" class="form-control">
                <option value="key-auth">Authorize with simple API Keys (key-auth)</option>
                <option value="oauth2">Authorize using OAuth 2.0 (oauth2)</option>
            </select>
        </div>
        <wicked-panel v-if="value.auth == 'oauth2'" :open=true type="info" title="OAuth 2.0 Settings">
            <label>Supported Flows:</label>
            <wicked-checkbox v-model="value.settings.enable_client_credentials" label="<b>Client Credentials</b> (two-legged, machine to machine)" />
            <wicked-checkbox v-model="value.settings.enable_implicit_grant" label="<b>Implicit Grant</b> (three-legged, for e.g Single Page Applications/client side JavaScript)" />
            <wicked-checkbox v-model="value.settings.enable_password_grant" label="<b>Resource Owner Password Grant</b> (three-legged, for e.g. native mobile Apps)" />
            <wicked-checkbox v-model="value.settings.enable_authorization_code" label="<b>Authorization Code Grant</b> (three-legged, for APIs delegating access to user data)" />
            <wicked-input v-model="value.settings.token_expiration" label="Token Expiration (seconds):" />
            <wicked-input v-model="value.settings.scopes" label="Scopes:" hint="Space-separated list of scopes." :env-var="envPrefix + 'SCOPES'" />
            <wicked-checkbox v-model="value.settings.mandatory_scope" label="<b>Mandatory Scope:</b> If specified, it is not possible to create access tokens without explicitly specifying a scope. Otherwise an access token with an empty scope may be created." />
            <hr>
            <h5>Specify Auth Methods</h5>
            <p>In order to use OAuth2 to secure this API, you must specify which Auth Methods on your registered Authorization Servers
               may be used to access this API. Most auth methods can be used with most OAuth2 flows, although there may be restrictions,
               e.g. you will not be able to use the Resource Owner Password Grant using a Google Authentication (only works with a User
               Agent).</p>
            <p><a href="/authservers" target="_blank">Configure Auth Methods (Authorization Server)</a> (opens in new window, reload this page for changes to take effect).</p>
            <div v-for="am in authMethods">
                <input v-model="value.authMethods" type="checkbox" :id="am.serverId + '_' + am.name" :value="am.serverId + ':' + am.name"/>
                <label :for="am.serverId + '_' + am.name">{{ am.friendlyShort }} (<code>{{ am.serverId + ':' + am.name }}</code>) <span style="color:red;">{{ !am.enabled ? ' - currently disabled' : '' }}</span></label>
            </div>
        </wicked-panel>
    </wicked-panel>
    `
});

Vue.component('wicked-api-kong', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel :open=true title="Kong (Gateway) Configuration" type="danger">
        <wicked-input v-model="value.api.upstream_url" label="Upstream (backend) URL:" hint="The URL under which the service can be found, <strong>as seen from the Kong container</strong>" :env-var="envPrefix + 'UPSTREAM_URL'" />
        <wicked-string-array v-model="value.api.uris" :allow-empty=false label="Request URIs:" hint="This is the list of prefix you will use for this API on the API Gateway, e.g. <code>/petstore/v1</code>." />
        <wicked-checkbox v-model="value.api.strip_uri" label="<b>Strip Uri</b>. Check this box if you don't want to pass the uri to the backend URL as well. Normally you wouldn't want that." />
        <wicked-checkbox v-model="value.api.preserve_host" label="<b>Preserve Host</b>. Preserves the original <code>Host</code> header sent by the client, instead of replacing it with the hostname of the <code>upstream_url</code>." />
    </wicked-panel>
`
});

Vue.component('wicked-api-desc', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel :open=false title="Long API Description" type="primary">
        <p>Edit the long description of your API; this is displayed on the main information page of the API; it can
           contain markdown code.</p>
        <wicked-markdown v-on:input="$emit('input', $event)" :value="value" />
    </wicked-panel>
`
});

Vue.component('wicked-api-swagger', {
    props: ['value', 'envPrefix'],
    template: `
    <wicked-panel :open=false title="Swagger/OpenAPI" type="primary">
        <p>If you have trouble in writing valid JSON, try <a href='http://www.jsonlint.org' target='_blank'>JSONlint</a>
           or something similar. A good friend is always <a href='http://editor.swagger.io' target='_blank'>editor.swagger.io</a>.
           It will do more for you, like visualizing things and making sure it's valid Swagger. You can copy this file
           from here and paste it there (it takes both JSON or YAML). Here you'll have to make sure it's JSON.
           If you have YAML, you can paste it here, and the wicked Kickstarter will convert it to JSON.</p>
        <p>In case your backend service has its own end point serving the Swagger JSON, you can point wicked to this location
           by inserting the following JSON into this file: <code>{"href":"http://your.backend/api-docs"}</code>. The <code>href</code>
           may contain environment variables; add here, save, and then edit in the <a href="/envs">Environments section</a>.</p>
        <wicked-input v-on:input="$emit('input', $event)" :textarea=true height="500px" :value="value" />
    </wicked-panel>
`
});

// ==============================================================

const vm = new Vue({
    el: '#vueBase',
    data: injectedData
});

function storeData() {
    const apiId = vm.api.id;
    $.post({
        url: `/apis/${apiId}/api`,
        data: JSON.stringify(vm.$data),
        contentType: 'application/json'
    }).fail(function () {
        alert('Could not store data, an error occurred.');
    }).done(function (data) {
        if (data.message == 'OK')
            alert('Successfully stored data.');
        else
            alert('The data was stored, but the backend returned the following message:\n\n' + data.message);
    });
}
