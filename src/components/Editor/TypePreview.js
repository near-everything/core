import React, { useState } from "react";
import { CreateWidget, ViewWidget } from "../../data/widgets";
import { Widget } from "../Widget/Widget";

export default function TypePreview(props) {
  const { renderJson, jpath } = props;
  const { viewProps, setViewProps } = useState({});

  return (
    // <Widget
    //   key={`preview-${jpath}-view`}
    //   code={ViewWidget}
    //   data={renderJson}
    // />
    <Widget
    key={`preview-${jpath}-create`}
    code={CreateWidget}
    data={renderJson}
  />
  );
}
