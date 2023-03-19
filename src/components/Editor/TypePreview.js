import React, { useState } from "react";

export default function TypePreview(props) {
  const { properties } = props;
  const { viewProps, setViewProps } = useState({});

  return (
    <>
      <div className="d-flex flex-column gap-2">
        {properties.map((it) => {
          switch (it.type) {
            case "String":
              return (
                <input
                  placeholder={it.name}
                  onChange={({ target }) =>
                    setViewProps({ ...viewProps, [it.name]: target.value })
                  }
                />
              );
            case "md":
              return (
                <textarea
                  onInput={({ target }) =>
                    setViewProps({ ...viewProps, [it.name]: target.value })
                  }
                  placeholder={it.name}
                />
              );
            default:
              return <div>no match</div>;
          }
        })}
      </div>
    </>
    // <Widget
    //   key={`preview-${jpath}-view`}
    //   code={ViewWidget}
    //   data={renderJson}
    // />
    //   <Widget
    //   key={`preview-${jpath}-create`}
    //   code={CreateWidget}
    //   data={renderJson}
    // />
  );
}
