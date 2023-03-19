import React, { useState } from "react";

export default function PropertyCreator(props) {
  const { addProperty, removeProperty, properties } = props;
  const [name, setName] = useState("");
  const [type, setType] = useState("String");
  const [required, setRequired] = useState(false);

  return (
    <>
      <table class="table table-striped">
        <thead>
          <tr>
            <th scope="col">Property Name</th>
            <th scope="col">Type</th>
            <th scope="col">Required</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((it) => 
            <tr key={it}>
              <th scope="row">{it.name}</th>
              <td>{it.type}</td>
              <td>{(it.required || false).toString()}</td>
              <td><button
                className="btn btn-danger"
                onClick={() => removeProperty(it)}
              >
                &#9472;
              </button></td>
            </tr>
          )}
          <tr>
            <td>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </td>
            <td>
              <select
                id="type"
                placeholder="select type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="String">String</option>
                <option value="md">Markdown</option>
              </select>
            </td>
            <td>
              <input
                type="checkbox"
                value={required}
                onChange={() => setRequired(!required)}
              />
            </td>
            <td>
              {" "}
              <button
                className="btn btn-success"
                onClick={() => addProperty({ name, type, required })}
                disabled={name === ""}
              >
                &#43;
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
