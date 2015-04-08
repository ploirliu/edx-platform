;(function (define, undefined) {
    'use strict';
    define([
        'gettext', 'jquery', 'underscore', 'backbone', 'js/mustache', 'js/views/message_banner', 'backbone-super'
    ], function (gettext, $, _, Backbone, RequireMustache, MessageBannerView) {

        var Mustache = window.Mustache || RequireMustache;

        var messageRevertDelay = 4000;
        var FieldViews = {};

        FieldViews.FieldView = Backbone.View.extend({
                
            fieldType: 'generic',

            className: function () {
                return 'u-field' + ' u-field-' + this.fieldType + ' u-field-' + this.options.valueAttribute;
            },

            tagName: 'div',

            indicators: {
                'canEdit': '<i class="icon fa fa-pencil message-can-edit" aria-hidden="true"></i>',
                'error': '<i class="fa fa-exclamation-triangle message-error" aria-hidden="true"></i>',
                'validationError': '<i class="fa fa-exclamation-triangle message-validation-error" aria-hidden="true"></i>',
                'inProgress': '<i class="fa fa-spinner fa-pulse message-in-progress" aria-hidden="true"></i>',
                'success': '<i class="fa fa-check message-success" aria-hidden="true"></i>',
                'plus': '<i class="fa fa-plus placeholder" aria-hidden="true"></i>'
            },

            messages: {
                'canEdit': '',
                'error': gettext('An error occurred. Please try again.'),
                'validationError': '',
                'inProgress': gettext('Saving'),
                'success': gettext('Your changes have been saved.')
            },

            initialize: function (options) {

                this.template = _.template($(this.templateSelector).text());

                this.helpMessage = this.options.helpMessage || '';
                this.showMessages = _.isUndefined(this.options.showMessages) ? true : this.options.showMessages;

                _.bindAll(this, 'modelValue', 'modelValueIsSet', 'message', 'getMessage', 'title',
                          'showHelpMessage', 'showInProgressMessage', 'showSuccessMessage', 'showErrorMessage');
            },

            modelValue: function () {
                return this.model.get(this.options.valueAttribute);
            },

            modelValueIsSet: function() {
                return (this.modelValue() == true);
            },

            message: function (message) {
                return this.$('.u-field-message').html(message);
            },

            title: function (text) {
                return this.$('.u-field-title').html(text);
            },

            getMessage: function(message_status) {
                if ((message_status + 'Message') in this) {
                    return this[message_status + 'Message'].call(this);
                } else if (this.showMessages) {
                    return this.indicators[message_status] + this.messages[message_status];
                }
                return this.indicators[message_status];
            },

            showCanEditMessage: function(show) {
                if (!_.isUndefined(show) && show) {
                    this.message(this.getMessage('canEdit'));
                } else {
                    this.message('');
                }
            },

            showHelpMessage: function () {
                this.message(this.helpMessage);
            },

            showInProgressMessage: function () {
                this.message(this.getMessage('inProgress'));
            },

            showSuccessMessage: function () {
                var successMessage = this.getMessage('success');
                this.message(successMessage);

                if (this.options.refreshPageOnSave) {
                    document.location.reload();
                }

                var view = this;

                var context = Date.now();
                this.lastSuccessMessageContext = context;

                setTimeout(function () {
                    if ((context === view.lastSuccessMessageContext) && (view.message().html() == successMessage)) {
                        view.showHelpMessage();
                    }
                }, messageRevertDelay);
            },

            showErrorMessage: function (xhr) {
                if (xhr.status === 400) {
                    try {
                        var errors = JSON.parse(xhr.responseText);
                        var validationErrorMessage = Mustache.escapeHtml(errors['field_errors'][this.options.valueAttribute]['user_message']);
                        var message = this.indicators['validationError'] + validationErrorMessage;
                        this.message(message);
                    } catch (error) {
                        this.message(this.getMessage('error'));
                    }
                } else {
                    this.message(this.getMessage('error'));
                }
            }
        });

        FieldViews.EditableFieldView = FieldViews.FieldView.extend({

            initialize: function (options) {
                _.bindAll(this, 'saveAttributes', 'saveSucceeded', 'showDisplayMode', 'showEditMode', 'startEditing', 'finishEditing');
                this._super(options);

                this.editable = _.isUndefined(this.options.editable) ? 'always': this.options.editable;
                this.$el.addClass('editable-' + this.editable);

                if (this.editable === 'always') {
                    this.showEditMode(false);
                } else {
                    this.showDisplayMode(false);
                }
            },

            saveAttributes: function (attributes, options) {
                var view = this;
                var defaultOptions = {
                    contentType: 'application/merge-patch+json',
                    patch: true,
                    wait: true,
                    success: function () {
                        view.saveSucceeded();
                    },
                    error: function (model, xhr) {
                        view.showErrorMessage(xhr);
                    }
                };
                this.showInProgressMessage();
                this.model.save(attributes, _.extend(defaultOptions, options));
            },

            saveSucceeded: function () {
                this.showSuccessMessage();
            },

            showDisplayMode: function(render) {
                this.mode = 'display';
                if (render) { this.render(); }

                this.$el.removeClass('mode-edit');

                this.$el.toggleClass('mode-hidden', (this.editable === 'never' && !this.modelValueIsSet()));
                this.$el.toggleClass('mode-placeholder', (this.editable === 'toggle' && !this.modelValueIsSet()));
                this.$el.toggleClass('mode-display', (this.modelValueIsSet()));
            },

            showEditMode: function(render) {
                this.mode = 'edit';
                if (render) { this.render(); }

                this.$el.removeClass('mode-hidden');
                this.$el.removeClass('mode-placeholder');
                this.$el.removeClass('mode-display');

                this.$el.addClass('mode-edit');
            },

            startEditing: function (event) {
                if (this.editable === 'toggle' && this.mode !== 'edit') {
                    this.showEditMode(true);
                }
            },

            finishEditing: function(event) {
                if (this.fieldValue() !== this.modelValue()) {
                    this.saveValue();
                } else {
                    if (this.editable === 'always') {
                        this.showEditMode(true);
                    } else {
                        this.showDisplayMode(true);
                    }
                }
            }
        });

        FieldViews.ReadonlyFieldView = FieldViews.FieldView.extend({

            fieldType: 'readonly',

            templateSelector: '#field_readonly-tpl',

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'fieldValue', 'updateValueInField');
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateValueInField);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    title: this.options.title,
                    value: this.modelValue(),
                    message: this.helpMessage
                }));
                return this;
            },

            fieldValue: function () {
                return this.$('.u-field-value input').val();
            },

            updateValueInField: function () {
                this.$('.u-field-value input').val(Mustache.escapeHtml(this.modelValue()));
            }
        });

        FieldViews.TextFieldView = FieldViews.EditableFieldView.extend({

            fieldType: 'text',

            templateSelector: '#field_text-tpl',

            events: {
                'change input': 'saveValue'
            },

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'fieldValue', 'updateValueInField', 'saveValue');
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateValueInField);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    title: this.options.title,
                    value: this.modelValue(),
                    message: this.helpMessage
                }));
                return this;
            },

            fieldValue: function () {
                return this.$('.u-field-value input').val();
            },

            updateValueInField: function () {
                var value = (_.isUndefined(this.modelValue()) || _.isNull(this.modelValue())) ? '' : this.modelValue();
                this.$('.u-field-value input').val(Mustache.escapeHtml(value));
            },

            saveValue: function (event) {
                var attributes = {};
                attributes[this.options.valueAttribute] = this.fieldValue();
                this.saveAttributes(attributes);
            }
        });

        FieldViews.DropdownFieldView = FieldViews.EditableFieldView.extend({

            fieldType: 'dropdown',

            templateSelector: '#field_dropdown-tpl',

            events: {
                'click': 'startEditing',
                'change select': 'finishEditing',
                'focusout select': 'finishEditing'
            },

            initialize: function (options) {
                _.bindAll(this, 'render', 'optionForValue', 'fieldValue', 'displayValue', 'updateValueInField', 'saveValue');
                this._super(options);

                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateValueInField);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    mode: this.mode,
                    title: this.options.title,
                    iconName: this.options.iconName,
                    required: this.options.required,
                    selectOptions: this.options.options,
                    message: this.helpMessage
                }));

                this.updateValueInField();

                if (this.editable === 'toggle') {
                    this.showCanEditMessage(this.mode === 'display');
                }
                return this;
            },

            modelValueIsSet: function() {
                var value = this.modelValue();
                if (_.isUndefined(value) || _.isNull(value) || value == '') {
                    return false;
                } else {
                    return !(_.isUndefined(this.optionForValue(value)))
                }
            },

            optionForValue: function(value) {
                return _.find(this.options.options, function(option) { return option[0] == value; })
            },

            fieldValue: function () {
                return this.$('.u-field-value select').val();
            },

            displayValue: function (value) {
                if (value) {
                    var option = this.optionForValue(value);
                    return (option ? option[1] : '');
                } else {
                    return '';
                }
            },

            updateValueInField: function () {
                if (this.mode === 'display') {
                    var value = this.displayValue(this.modelValue() || '');
                    if (this.modelValueIsSet() === false) {
                        value = this.options.placeholderValue || '';
                    }
                    this.$('.u-field-value').html(Mustache.escapeHtml(value));
                    this.showDisplayMode(false);
                } else {
                    this.$('.u-field-value select').val(this.modelValue() || '');
                }
            },

            saveValue: function () {
                var attributes = {};
                attributes[this.options.valueAttribute] = this.fieldValue();
                this.saveAttributes(attributes);
            },

            showEditMode: function(render) {
                this._super(render);
                if (this.editable === 'toggle') {
                    this.$('.u-field-value select').focus();
                }
            },

            saveSucceeded: function() {
                this._super();
                if (this.editable === 'toggle') {
                    this.showDisplayMode(true);
                }
            },

            disableField: function(disable) {
                this.$('.u-field-value select').prop('disabled', disable);
            }
        });

        FieldViews.TextareaFieldView = FieldViews.EditableFieldView.extend({

            fieldType: 'textarea',

            templateSelector: '#field_textarea-tpl',

            events: {
                'click .wrapper-u-field': 'startEditing',
                'click .u-field-placeholder': 'startEditing',
                'focusout textarea': 'finishEditing',
                'change textarea': 'adjustTextareaHeight',
                'keyup textarea': 'adjustTextareaHeight',
                'keydown textarea': 'adjustTextareaHeight',
                'paste textarea': 'adjustTextareaHeight',
                'cut textarea': 'adjustTextareaHeight'
            },

            initialize: function (options) {
                _.bindAll(this, 'render', 'adjustTextareaHeight', 'fieldValue', 'saveValue', 'updateView');
                this._super(options);
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateView);
            },

            render: function () {
                var value = this.modelValue();
                if (this.mode === 'display') {
                    value = value || this.options.placeholderValue;
                }
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    mode: this.mode,
                    value: value,
                    message: this.helpMessage
                }));

                this.title((this.modelValue() || this.mode === 'edit') ? this.options.title : this.indicators['plus'] + this.options.title);

                if (this.editable === 'toggle') {
                    this.showCanEditMessage(this.mode === 'display');
                }
                return this;
            },

            adjustTextareaHeight: function(event) {
                var textarea = this.$('textarea');
                textarea.css('height', 'auto').css('height', textarea.prop('scrollHeight') + 10);
            },

            modelValue: function() {
                var value = this._super();
                return  value ? $.trim(value) : '';
            },

            fieldValue: function () {
                return this.$('.u-field-value textarea').val();
            },

            saveValue: function () {
                var attributes = {};
                attributes[this.options.valueAttribute] = this.fieldValue();
                this.saveAttributes(attributes);
            },

            updateView: function () {
                if (this.mode !== 'edit') {
                    this.showDisplayMode(true);
                }
            },

            modelValueIsSet: function() {
                return !(this.modelValue() === '');
            },

            showEditMode: function(render) {
                this._super(render);
                this.adjustTextareaHeight();
                this.$('.u-field-value textarea').focus();
            },

            saveSucceeded: function() {
                this._super();
                if (this.editable === 'toggle') {
                    this.showDisplayMode(true);
                }
            }
        });

        FieldViews.LinkFieldView = FieldViews.FieldView.extend({

            fieldType: 'link',

            templateSelector: '#field_link-tpl',

            events: {
                'click a': 'linkClicked'
            },

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'linkClicked');
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    title: this.options.title,
                    linkTitle: this.options.linkTitle,
                    linkHref: this.options.linkHref,
                    message: this.helpMessage
                }));
                return this;
            },

            linkClicked: function () {
                event.preventDefault();
            }
        });

        FieldViews.ImageFieldView = FieldViews.FieldView.extend({

            fieldType: 'image',

            templateSelector: '#field_image-tpl',
            uploadButtonSelector: '.upload-button-input',

            titleAdd: 'upload a photo',
            titleEdit: 'change photo',
            titleRemove: 'remove',

            iconUpload: '<i class="icon fa fa-camera" aria-hidden="true"></i>',
            iconRemove: '<i class="icon fa fa-remove" aria-hidden="true"></i>',
            iconProgress: '<i class="icon fa fa-spinner fa-pulse fa-spin" aria-hidden="true"></i>',

            errorMessage: gettext("We've encountered an error. Refresh your browser and then try again."),

            events: {
                'click .u-field-upload-button': 'clickedUploadButton',
                'click .u-field-remove-button': 'clickedRemoveButton'
            },

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'successHandler', 'failureHandler', 'fileUploadHandler', 'addWindowActions',
                          'onBeforeUnload');
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.render);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    imageLink: this.model.profileImageUrl(),
                    uploadButtonIcon: _.result(this, 'iconUpload'),
                    uploadButtonTitle: _.result(this, 'uploadButtonTitle'),
                    removeButtonIcon: _.result(this, 'iconRemove'),
                    removeButtonTitle: _.result(this, 'removeButtonTitle')
                }));
                this.setElementVisibility('none');
                this.addWindowActions();
                return this;
            },

            clickedUploadButton: function () {
                $(this.uploadButtonSelector).fileupload({
                    url: this.options.profileImageUploadUrl,
                    type: 'POST',
                    autoUpload: true,
                    add: this.fileUploadHandler,
                    done: this.successHandler,
                    fail: this.failureHandler
                });
            },

            clickedRemoveButton: function () {
                var self = this;
                this.hideUserErrorMessage();
                this.setCurrentStatus('remove');
                this.showRemovalInProgressMessage();
                this.showInProgressMessage('Removing...');
                 $.ajax({
                    type: 'POST',
                    url: this.options.profileImageRemoveUrl,
                    success: function (data, status, xhr) {
                        self.successHandler();
                    },
                    error: function (xhr, status, error) {
                       self.failureHandler();
                    }
                });
            },

            uploadButtonTitle: function () {
                if (this.model.has_profile_image()) {
                    return _.result(this, 'titleEdit')
                } else {
                    return _.result(this, 'titleAdd')
                }
            },

            removeButtonTitle: function () {
                return this.titleRemove;
            },

            successHandler: function (e, data) {
                var self = this;
                // Update model to get the latest urls of profile image.
                this.model.fetch().done(function () {
                    self.render();
                    self.setCurrentStatus('');
                }).fail(function () {
                    self.showUserErrorMessage(self.errorMessage);
                });
            },

            failureHandler: function (e, data) {
                this.setCurrentStatus('');
                 if (_.contains([400, 404], data.jqXHR.status)) {
                    try {
                        var errors = JSON.parse(data.jqXHR.responseText);
                        this.showUserErrorMessage(errors.user_message);
                    } catch (error) {
                        this.showUserErrorMessage(this.errorMessage);
                    }
                } else {
                    this.showUserErrorMessage(this.errorMessage);
                }
                this.render();
            },

            fileUploadHandler: function (e, data) {
                if (this.validateImageSize(data.files[0].size)) {
                    data.formData = {file: data.files[0]};
                    this.hideUserErrorMessage();
                    this.setCurrentStatus('upload');
                    this.showUploadInProgressMessage();
                    data.submit();
                }
            },

            validateImageSize: function (imageBytes) {
                if (imageBytes < this.options.imageMinBytes) {
                    this.showUserErrorMessage('Minimum file size not met.');
                    return false;
                } else if (imageBytes > this.options.imageMaxBytes) {
                    this.showUserErrorMessage('Maximum file size exceeded.');
                    return false;
                }
                return true;
            },

            showUploadInProgressMessage: function () {
                this.$('.upload-button-wrapper').css('opacity', 1);
                this.$('.upload-button-icon').html(this.iconProgress);
                this.$('.upload-button-title').html('Uploading...');
            },

            showRemovalInProgressMessage: function () {
                this.$('.u-field-remove-button').css('opacity', 1);
                this.$('.remove-button-icon').html(this.iconProgress);
                this.$('.remove-button-title').html('Removing...');
            },

            setCurrentStatus: function (status) {
                this.$('.image-wrapper').attr('data-status', status);
            },

            getCurrentStatus: function () {
                return this.$('.image-wrapper').attr('data-status');
            },

            showUserErrorMessage: function (message) {
                 var messageBannerView = new MessageBannerView({
                    el: '.error-message-banner',
                    message: message
                });
                messageBannerView.render();
            },

            hideUserErrorMessage: function () {
                $('.error-message-banner').html('');
            },

            setElementVisibility: function (state) {
                if (!this.model.isAboveMinimumAge()) {
                    this.$('.upload-button-wrapper').css('display', state);
                }

                if (!this.model.has_profile_image()) {
                    this.$('.u-field-remove-button').css('display', state);
                }

                if(this.inProgress() ||  this.options.editable === 'never') {
                    this.$('.upload-button-wrapper').css('display', state);
                    this.$('.u-field-remove-button').css('display', state);
                }
            },

            addWindowActions: function () {
                $(window).on('beforeunload', this.onBeforeUnload);
            },

            inProgress: function() {
                var status = this.getCurrentStatus();
                return _.isUndefined(status) ? false : true;
            },

            onBeforeUnload: function () {
                var status = this.getCurrentStatus();
                var message = gettext("{status} is in progress. Navigating away will abort it.");

                if (status === 'upload') {
                    return interpolate_text(message, {status: 'Uploading'});
                } else if (status === 'remove') {
                    return interpolate_text(message, {status: 'Removal'});
                }
            }
        });

        return FieldViews;
    })
}).call(this, define || RequireJS.define);
