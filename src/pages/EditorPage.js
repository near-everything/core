import React, { useState } from "react";
import TypeEditor from "../components/Editor/TypeEditor";
import WidgetEditor from "../components/Editor/WidgetEditor";

const View = {
  Widgets: "Widgets",
  Types: "Types",
};

export default function EditorPage(props) {
  const [view, setView] = useState(View.Widgets);

  return (
    <div className="container-fluid mt-1">
      <div className="mb-3">
        <div className="flex-grow-1">
          <div className="row">
            <ul
              className={"nav nav-tabs mb-2"}
              style={{ marginLeft: "0.5rem" }} // TODO: why doesn't ml-2 work?
            >
              <li className="nav-item">
                <button
                  className={`nav-link ${
                    view === View.Widgets ? "active" : ""
                  }`}
                  aria-current="page" // TODO: idk aria, is this okay?
                  onClick={() => setView(View.Widgets)}
                >
                  Widgets
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${view === View.Types ? "active" : ""}`}
                  aria-current="page" // TODO: idk aria, is this okay?
                  onClick={() => setView(View.Types)}
                >
                  Types
                </button>
              </li>
            </ul>
          </div>
          <div className="d-flex align-content-start">
            <div className="flex-grow-1">
              <div className="row">
                <div
                  className={`${
                    view === View.Widgets ? "" : "visually-hidden"
                  }`}
                >
                  <WidgetEditor {...props} />
                </div>
                <div
                  className={`${view === View.Types ? "" : "visually-hidden"}`}
                >
                  <TypeEditor {...props} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
