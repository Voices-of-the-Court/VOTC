interface TemplateEditorModalProps {
  path: string;
  content: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onClose: () => void;
}

const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  path,
  content,
  onChange,
  onSave,
  onClose,
}) => {
  return (
    <div className="template-editor-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h4>Edit {path}</h4>
          <button onClick={onClose}>×</button>
        </div>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={20}
          style={{ width: '100%' }}
        />
        <div className="modal-actions">
          <button onClick={() => onSave(content)}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorModal;
