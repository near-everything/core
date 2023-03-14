import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";

export default function OpenModal(props) {
  const onHide = props.onHide;
  const onOpen = props.onOpen;
  const onNew = props.onNew;
  const show = props.show;

  const [typeSrc, setTypeSrc] = useState("");

  return (
    <Modal centered scrollable show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Open type</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <label htmlFor="type-src-input" className="form-label">
          Type name <span className="text-muted">(or path)</span>
        </label>
        <input
          className="form-control"
          id="type-src-input"
          type="text"
          value={typeSrc}
          onChange={(e) =>
            setTypeSrc(e.target.value.replaceAll(/[^a-zA-Z0-9_.\-\/]/g, ""))
          }
        />
      </Modal.Body>
      <Modal.Footer>
        <button
          className="btn btn-success"
          disabled={!typeSrc}
          onClick={(e) => {
            e.preventDefault();
            onOpen(typeSrc);
            setTypeSrc("");
            onHide();
          }}
        >
          Open
        </button>
        <button
          className="btn btn-outline-success"
          disabled={typeSrc && typeSrc.indexOf("/") !== -1}
          onClick={(e) => {
            e.preventDefault();
            onNew(typeSrc);
            setTypeSrc("");
            onHide();
          }}
        >
          Create New
        </button>
        <button className="btn btn-secondary" onClick={onHide}>
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
}
