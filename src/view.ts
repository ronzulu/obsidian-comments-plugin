import { ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';
import { VIEW_TYPE_OB_COMMENTS } from './constants'
import { debounce } from './utils'

export class CommentsView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.redraw = this.redraw.bind(this);
        this.redraw_debounced = this.redraw_debounced.bind(this);
        this.containerEl = this.containerEl;
        this.registerEvent(this.app.workspace.on("layout-ready", this.redraw_debounced));
        this.registerEvent(this.app.workspace.on("file-open", this.redraw_debounced));
        this.registerEvent(this.app.workspace.on("quick-preview", this.redraw_debounced));
        this.registerEvent(this.app.vault.on("delete", this.redraw));
    }

    getViewType(): string {
        return VIEW_TYPE_OB_COMMENTS;
    }

    getDisplayText(): string {
        return "Comments";
    }

    getIcon(): string {
        return "lines-of-text";
    }

    onClose(): Promise<void> {
        return Promise.resolve();
    }

    async onOpen(): Promise<void> {
        this.redraw();
    }

    redraw_debounced = debounce(function () {
        this.redraw();
    }, 1000);

    async generateDivForTag(tagName: string) { 
        let tagElement = document.createElement("div"); 
        try {
            await MarkdownRenderer.renderMarkdown(
                tagName,
                tagElement,
                "not-a-actual-path",
                null
            );
        }
        catch(e){
            console.debug("hello");
            console.debug('Exception: ' + e);
            console.trace();
            
            tagElement = document.createElement("div"); 
            tagElement.setText('Exception: ' + e);
        }
        return tagElement;
    }

    formatContentText(commentHtml: HTMLElement) : string {
   
        // <label class="ob-comment" title="" style=""> serious way <input type="checkbox"> <span style=""> #exaggeration That's a serious allegation </span></label> 
        // We are after the " serious way " in the above
        let end = commentHtml.innerHTML.length - commentHtml.querySelector('input[type=checkbox]+span').outerHTML.length - commentHtml.querySelector('input[type=checkbox]').outerHTML.length - 1;
        return commentHtml.innerHTML.substring(0, end);
    }
    
    
    findEndOfTag(comment: string, start: number) {
        for (var i = start; i < comment.length; i++) {
            if (comment[i] == " ")
                return i;
        }
        return i;
    }    

    extractTagsFromComment(comment: string) { 
        let remainingComment = "";
        var tagList = new Array<string>();
        for (var i = 0; i < comment.length; i++) {
            if (comment[i] == "#") { 
                let end = this.findEndOfTag(comment, i);
                if (end == -1)
                    remainingComment += comment[i];
                else { 
                    let tag = comment.substring(i, end);
                    tagList.push(tag);
                    i = end;
                }
            }
            else { 
                remainingComment += comment[i];
            }
        }
        return [remainingComment, tagList];
    }

    async createDivElementForSourceComment(sourceComment: HTMLElement) { 
        let div = document.createElement('Div');
        div.setAttribute('class', 'comment-pannel-bubble')

        let labelEl = document.createElement("label");
        let pEl = document.createElement("p");
        pEl.setAttribute('class', 'comment-pannel-p1')

        // Check if user specified a title for this comment
        if (!sourceComment.title || sourceComment.title === "") {
            // if no title specified, use the line number
            pEl.setText('--');
        } else {
            // Use the given title
            pEl.setText(sourceComment.title)
        }
        labelEl.appendChild(pEl)

        let inputEl = document.createElement("input");
        inputEl.setAttribute('type', 'checkbox')
        inputEl.setAttribute('style', 'display:none;')
        labelEl.appendChild(inputEl)

        pEl = document.createElement("p");
        pEl.setAttribute('class', 'comment-pannel-p2')
        pEl.setText(formatContentText(sourceComment));
        labelEl.appendChild(pEl)
        div.appendChild(labelEl)

        let comment = sourceComment.querySelector('input[type=checkbox]+span').innerHTML;
        let [remainingComment, tagList] = this.extractTagsFromComment(comment);

        for (var tagName of tagList) {
            let tagElement = await this.generateDivForTag(tagName);
            div.appendChild(tagElement);
        }

        labelEl = document.createElement("label");
        inputEl = document.createElement("input");
        inputEl.setAttribute('type', 'checkbox')
        inputEl.setAttribute('style', 'display:none;')
        labelEl.appendChild(inputEl)
        pEl = document.createElement("p");
        pEl.setAttribute('class', 'comment-pannel-p3')
        pEl.setText(remainingComment);

        // Check if user specified additional style for this note
        // if no style was assigned, use default
        if (sourceComment.style.cssText) {
            // Add the new style
            pEl.setAttribute('style', sourceComment.style.cssText)
        }
        labelEl.appendChild(pEl)
        div.appendChild(labelEl);
        return div;        
    }

    async redraw() {
        let active_leaf = this.app.workspace.getActiveFile();
        this.containerEl.empty();
        this.containerEl.setAttribute('class', 'comment-panel')

        // Condition if current leaf is present
        if (active_leaf) {
            let page_content = await this.app.vault.read(active_leaf);
            let tagElement = await this.generateDivForTag("#new-tag");
            this.containerEl.appendChild(tagElement);

            // Convert into HTML element 
            let page_html = document.createElement('Div')
            page_html.innerHTML = page_content;
            // Use HTML parser to find the desired elements
            // Get all .ob-comment elements
            let comment_list = page_html.querySelectorAll<HTMLElement>("label[class='ob-comment']");

            let El = document.createElement("h3");
            El.setAttribute('class', 'comment-count')
            this.containerEl.appendChild(El);
            El.setText('Comments v12: ' + comment_list.length);

            for (let i = 0; i < comment_list.length; i++) {
                let div = await this.createDivElementForSourceComment(comment_list[i]);

                this.containerEl.appendChild(div)
            }
        }
    }
}