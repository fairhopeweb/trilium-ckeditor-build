import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import {toWidget, viewToModelPositionOutsideModelElement} from '@ckeditor/ckeditor5-widget/src/utils';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import Command from '@ckeditor/ckeditor5-core/src/command';

export default class ReferenceLink extends Plugin {
	static get requires() {
		return [ ReferenceLinkEditing ];
	}
}

class ReferenceLinkCommand extends Command {
	execute( { notePath } ) {
		if (!notePath || !notePath.trim()) {
			return;
		}

		const editor = this.editor;

		const noteId = notePath.split('/').pop();

		// make sure the referenced note is in cache before adding reference element
		glob.treeCache.getNote(noteId, true).then(() => {
			editor.model.change(writer => {
				const placeholder = writer.createElement('reference', {notePath: notePath});

				// ... and insert it into the document.
				editor.model.insertContent(placeholder);

				// Put the selection on the inserted element.
				writer.setSelection(placeholder, 'after');
			});
		});
	}

	refresh() {
		const model = this.editor.model;
		const selection = model.document.selection;

		this.isEnabled = model.schema.checkChild(selection.focus.parent, 'reference');
	}
}

class ReferenceLinkEditing extends Plugin {
	static get requires() {
		return [ Widget ];
	}

	init() {
		this._defineSchema();
		this._defineConverters();

		this.editor.commands.add( 'referenceLink', new ReferenceLinkCommand( this.editor ) );

		this.editor.editing.mapper.on(
			'viewToModelPosition',
			viewToModelPositionOutsideModelElement( this.editor.model,
					viewElement => viewElement.hasClass( 'reference-link' ) )
		);
	}

	_defineSchema() {
		const schema = this.editor.model.schema;

		schema.register( 'reference', {
			// Allow wherever text is allowed:
			allowWhere: '$text',

			isInline: true,

			// The inline widget is self-contained so it cannot be split by the caret and it can be selected:
			isObject: true,

			allowAttributes: [ 'notePath' ]
		} );
	}

	_defineConverters() {
		const editor = this.editor;
		const conversion = editor.conversion;

		conversion.for( 'upcast' ).elementToElement( {
			view: {
				name: 'a',
				classes: [ 'reference-link' ]
			},
			model: ( viewElement, modelWriter ) => {
				const notePath = viewElement.getAttribute('data-note-path');

				return modelWriter.createElement( 'reference', { notePath: notePath } );
			}
		} );

		conversion.for( 'editingDowncast' ).elementToElement( {
			model: 'reference',
			view: ( modelItem, viewWriter ) => {
				const notePath = modelItem.getAttribute( 'notePath' );

				const referenceLinkView = viewWriter.createUIElement('a', {
					href: '#' + notePath,
					class: 'reference-link',
					'data-note-path': notePath,
				}, function( domDocument ) {
					const domElement = this.toDomElement( domDocument );
					const noteId = notePath.split('/').pop();

					const editorEl = editor.editing.view.getDomRoot();
					const component = glob.getComponentByEl(editorEl);

					component.loadReferenceLinkTitle(noteId, $(domElement));

					return domElement;
				});

				// Enable widget handling on a reference element inside the editing view.
				return toWidget( referenceLinkView, viewWriter );
			}
		} );

		conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'reference',
			view: ( modelItem, viewWriter ) => {
				const notePath = modelItem.getAttribute( 'notePath' );

				const referenceLinkView = viewWriter.createContainerElement( 'a', {
					href: '#' + notePath,
					class: 'reference-link',
					'data-note-path': notePath,
				} );

				const noteId = notePath.split('/').pop();
				// needs to be sync
				const note = glob.treeCache.getNoteFromCache(noteId);

				if (note) {
					const innerText = viewWriter.createText(note.title);
					viewWriter.insert(viewWriter.createPositionAt(referenceLinkView, 0), innerText);
				}

				return referenceLinkView;
			}
		} );
	}
}
