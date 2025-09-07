import React from 'react';

interface FormGroupInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
    // type is already part of InputHTMLAttributes, defaults to 'text' if not specified by React
}

const FormGroupInput: React.FC<FormGroupInputProps> = ({ id, label, type = 'text', ...rest }) => (
    <div className="form-group">
        <label htmlFor={id}>{label}</label>
        <input id={id} name={id} type={type} {...rest} />
    </div>
);

export default FormGroupInput;
