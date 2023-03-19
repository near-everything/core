import Editor from "@monaco-editor/react";
import ls from "local-storage";
import prettier from "prettier";
import parserBabel from "prettier/parser-babel";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "react-bootstrap";
import { useHistory, useParams } from "react-router-dom";
import { useAccountId } from "../../data/account";
import { useCache } from "../../data/cache";
import { LsKey, NearConfig, useNear } from "../../data/near";
import { CreateWidget, ViewWidget } from "../../data/widgets";
import { CommitButton } from "../Commit";
import OpenModal from "../Editor/OpenModal";
import RenameModal from "../Editor/RenameModal";
import { Widget } from "../Widget/Widget";
import PropertyCreator from "./PropertyCreator";
import TypeCreator from "./PropertyCreator";
import TypePreview from "./TypePreview";

const StorageDomain = {
  page: "type-editor",
};

const StorageType = {
  Json: "json",
  Files: "files",
};

const Filetype = {
  Type: "type",
  Module: "module",
};

const DefaultEditorJson = "{}";

const Tab = {
  Editor: "Editor",
  Metadata: "Metadata",
  Type: "Type",
};

export default function TypeEditor(props) {
  const { typeSrc } = useParams();
  const history = useHistory();
  const setTypeSrc = props.setTypeSrc;

  const [loading, setLoading] = useState(false);
  const [json, setJson] = useState(undefined);
  const [path, setPath] = useState(undefined);
  const [files, setFiles] = useState(undefined);
  const [lastPath, setLastPath] = useState(undefined);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [properties, setProperties] = useState([]);
  const [renderProperties, setRenderProperties] = useState([]);

  const [renderJson, setRenderJson] = useState(json);
  const [metadata, setMetadata] = useState(undefined);
  const near = useNear();
  const cache = useCache();
  const accountId = useAccountId();

  const [tab, setTab] = useState(Tab.Editor);

  useEffect(() => {
    setTypeSrc({
      edit: null,
      view: typeSrc,
    });
  }, [typeSrc, setTypeSrc]);

  const updateJson = useCallback(
    (path, json) => {
      cache.localStorageSet(
        StorageDomain,
        {
          path,
          type: StorageType.Json,
        },
        {
          json,
          time: Date.now(),
        }
      );
      setJson(json);
    },
    [cache, setJson]
  );

  const removeFromFiles = useCallback(
    (path) => {
      path = JSON.stringify(path);
      setFiles((files) =>
        files.filter((file) => JSON.stringify(file) !== path)
      );
      setLastPath(path);
    },
    [setFiles, setLastPath]
  );

  const addToFiles = useCallback(
    (path) => {
      const jpath = JSON.stringify(path);
      setFiles((files) => {
        const newFiles = [...files];
        if (!files.find((file) => JSON.stringify(file) === jpath)) {
          newFiles.push(path);
        }
        return newFiles;
      });
      setLastPath(path);
    },
    [setFiles, setLastPath]
  );

  useEffect(() => {
    if (files && lastPath) {
      cache.localStorageSet(
        StorageDomain,
        {
          type: StorageType.Files,
        },
        { files, lastPath }
      );
    }
  }, [files, lastPath, cache]);

  const openFile = useCallback(
    (path, json) => {
      setPath(path);
      addToFiles(path);
      setMetadata(undefined);
      setRenderJson(null);
      if (json !== undefined) {
        updateJson(path, json);
      } else {
        setLoading(true);
        cache
          .asyncLocalStorageGet(StorageDomain, {
            path,
            type: StorageType.Json,
          })
          .then(({ json }) => {
            updateJson(path, json);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    },
    [updateJson, addToFiles]
  );

  const toPath = useCallback((type, nameOrPath) => {
    const name =
      nameOrPath.indexOf("/") >= 0
        ? nameOrPath.split("/").slice(2).join("/")
        : nameOrPath;
    return { type, name };
  }, []);

  const loadFile = useCallback(
    (nameOrPath) => {
      if (!near) {
        return;
      }
      const typeSrc =
        nameOrPath.indexOf("/") >= 0
          ? nameOrPath
          : `${accountId}/type/${nameOrPath}`;
      const c = () => {
        const json = cache.socialGet(
          near,
          typeSrc,
          false,
          undefined,
          undefined,
          c
        );
        if (json) {
          const name = typeSrc.split("/").slice(2).join("/");
          openFile(toPath(Filetype.Type, typeSrc), json);
        }
      };

      c();
    },
    [accountId, openFile, toPath, near, cache]
  );

  const generateNewName = useCallback(
    (type) => {
      for (let i = 0; ; i++) {
        const name = `Draft-${i}`;
        const path = toPath(type, name);
        path.unnamed = true;
        const jPath = JSON.stringify(path);
        if (!files?.find((file) => JSON.stringify(file) === jPath)) {
          return path;
        }
      }
    },
    [toPath, files]
  );

  const createFile = useCallback(
    (type) => {
      const path = generateNewName(type);
      openFile(path, DefaultEditorJson);
    },
    [generateNewName, openFile]
  );

  const renameFile = useCallback(
    (newName, json) => {
      const newPath = toPath(path.type, newName);
      const jNewPath = JSON.stringify(newPath);
      const jPath = JSON.stringify(path);
      setFiles((files) => {
        const newFiles = files.filter(
          (file) => JSON.stringify(file) !== jNewPath
        );
        const i = newFiles.findIndex((file) => JSON.stringify(file) === jPath);
        if (i >= 0) {
          newFiles[i] = newPath;
        }
        return newFiles;
      });
      setLastPath(newPath);
      setPath(newPath);
      updateJson(newPath, json);
    },
    [path, toPath, updateJson]
  );

  useEffect(() => {
    cache
      .asyncLocalStorageGet(StorageDomain, { type: StorageType.Files })
      .then((value) => {
        const { files, lastPath } = value || {};
        setFiles(files || []);
        setLastPath(lastPath);
      });
  }, [cache]);

  useEffect(() => {
    if (!near || !files) {
      return;
    }
    if (typeSrc) {
      if (typeSrc === "new") {
        createFile(Filetype.Type);
      } else {
        loadFile(typeSrc);
      }
      analytics("edit", {
        props: {
          type: typeSrc,
        },
      });
      history.replace(`/edit/`);
    } else if (path === undefined) {
      if (files.length === 0) {
        createFile(Filetype.Type);
      } else {
        openFile(lastPath, undefined);
      }
    }
  }, [near, createFile, lastPath, files, path, typeSrc, openFile, loadFile]);

  const reformat = useCallback(
    (path, json) => {
      try {
        const formattedJson = prettier.format(json, {
          parser: "babel",
          plugins: [parserBabel],
        });
        updateJson(path, formattedJson);
      } catch (e) {
        console.log(e);
      }
    },
    [updateJson]
  );

  const typeName = path?.name;

  const generateJson = () => {
    return JSON.stringify({
      properties: properties,
      widgets: {
        view: `${accountId}/widget/Everything.View.${typeName}`,
        create: `${accountId}/widget/Everything.Create.${typeName}`,
      },
    });
  };

  const generateView = () => {
    return ViewWidget.replace(
      "{SVG}",
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" > <path d="M15.26 22C15.2 22 15.13 21.99 15.07 21.97C13.06 21.4 10.95 21.4 8.94003 21.97C8.57003 22.07 8.18003 21.86 8.08003 21.49C7.97003 21.12 8.19003 20.73 8.56003 20.63C10.82 19.99 13.2 19.99 15.46 20.63C15.83 20.74 16.05 21.12 15.94 21.49C15.84 21.8 15.56 22 15.26 22Z" fill="#292D32" /> <path d="M19.21 6.36001C18.17 4.26001 16.16 2.71001 13.83 2.20001C11.39 1.66001 8.88997 2.24001 6.97997 3.78001C5.05997 5.31001 3.96997 7.60001 3.96997 10.05C3.96997 12.64 5.51997 15.35 7.85997 16.92V17.75C7.84997 18.03 7.83997 18.46 8.17997 18.81C8.52997 19.17 9.04997 19.21 9.45997 19.21H14.59C15.13 19.21 15.54 19.06 15.82 18.78C16.2 18.39 16.19 17.89 16.18 17.62V16.92C19.28 14.83 21.23 10.42 19.21 6.36001ZM13.72 11.62L12.65 13.48C12.51 13.72 12.26 13.86 12 13.86C11.87 13.86 11.74 13.83 11.63 13.76C11.27 13.55 11.15 13.09 11.35 12.74L12.2 11.26H11.36C10.86 11.26 10.45 11.04 10.23 10.67C10.01 10.29 10.03 9.83001 10.28 9.39001L11.35 7.53001C11.56 7.17001 12.02 7.05001 12.37 7.25001C12.73 7.46001 12.85 7.92001 12.65 8.27001L11.8 9.75001H12.64C13.14 9.75001 13.55 9.97001 13.77 10.34C13.99 10.72 13.97 11.19 13.72 11.62Z" fill="#292D32" /> </svg>'
    ).replace(
      "{DATA}",
      properties.map((it) => {
        switch (it.type) {
          case "String":
            return `<p>{data["${it.name}"]}</p>`;
          case "md":
            return `<Markdown text={data["${it.name}"]} />`;
          default:
            return;
        }
      }).join(" ")
    );
  };

  const generateCreate = () => {
    const initState = properties.reduce((p, { name }) => {
      p[name] = "";
      return p;
    }, {});

    return CreateWidget.replace("TYPE_STR", `${accountId}/type/${typeName}`)
      .replace("PROPERTIES", JSON.stringify(initState))
      .replace("VERSION", "everythingv0")
      .replace(
        "{FORM_BODY}",
        properties.map((it) => {
          switch (it.type) {
            case "String":
              return `<Input placeholder="${it.name}" onChange={({ target }) => State.update({ "${it.name}": target.value })} />`;
            case "md":
              return `<TextArea placeholder="${it.name}" onInput={({ target }) => State.update({ "${it.name}": target.value })} />`;
            default:
              return;
          }
        }).join(" ")
      );
  };

  const commitButton = (
    <CommitButton
      className="btn btn-primary"
      disabled={!typeName}
      near={near}
      data={{
        type: {
          [typeName]: {
            "": generateJson(),
            metadata,
          },
        },
        widget: {
          [`Everything.Create.${typeName}`]: {
            "": generateCreate()
          },
          [`Everything.View.${typeName}`]: {
            "": generateView()
          },
        },
      }}
    >
      Save Type
    </CommitButton>
  );

  const typePath = `${accountId}/${path?.type}/${path?.name}`;
  const jpath = JSON.stringify(path);

  return (
    <div className="container-fluid mt-1">
      <RenameModal
        key={`rename-modal-${jpath}`}
        show={showRenameModal}
        name={path?.name}
        onRename={(newName) => renameFile(newName, json)}
        onHide={() => setShowRenameModal(false)}
      />
      <OpenModal
        show={showOpenModal}
        onOpen={(newName) => loadFile(newName)}
        onNew={(newName) =>
          newName
            ? openFile(toPath(Filetype.Type, newName), DefaultEditorJson)
            : createFile(Filetype.Type)
        }
        onHide={() => setShowOpenModal(false)}
      />
      <div className="mb-3">
        <Nav
          variant="pills mb-1"
          activeKey={jpath}
          onSelect={(key) => openFile(JSON.parse(key))}
        >
          {files?.map((p, idx) => {
            const jp = JSON.stringify(p);
            return (
              <Nav.Item key={jp}>
                <Nav.Link className="text-decoration-none" eventKey={jp}>
                  {p.name}
                  <button
                    className={`btn btn-sm border-0 py-0 px-1 ms-1 rounded-circle ${
                      jp === jpath
                        ? "btn-outline-light"
                        : "btn-outline-secondary"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeFromFiles(p);
                      if (jp === jpath) {
                        if (files.length > 1) {
                          openFile(files[idx - 1] || files[idx + 1]);
                        } else {
                          createFile(Filetype.Type);
                        }
                      }
                    }}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </Nav.Link>
              </Nav.Item>
            );
          })}
          <Nav.Item>
            <Nav.Link
              className="text-decoration-none"
              onClick={() => setShowOpenModal(true)}
            >
              <i className="bi bi-file-earmark-plus"></i> Add
            </Nav.Link>
          </Nav.Item>
        </Nav>
        {/* TODO: Convert to search for types */}
        {/* {NearConfig.widgets.editorComponentSearch && (
          <div>
            <Widget
              src={NearConfig.widgets.editorComponentSearch}
              props={useMemo(
                () => ({
                  extraButtons: ({ typeName, typePath, onHide }) => (
                    <OverlayTrigger
                      placement="auto"
                      overlay={
                        <Tooltip>
                          Open "{typeName}" component in the editor
                        </Tooltip>
                      }
                    >
                      <button
                        className="btn btn-outline-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          loadFile(typePath);
                          onHide && onHide();
                        }}
                      >
                        Open
                      </button>
                    </OverlayTrigger>
                  ),
                }),
                [loadFile]
              )}
            />
          </div>
        )} */}
      </div>
      <div className="d-flex align-content-start">
        <div className="flex-grow-1">
          <div className="row">
            <div className={"col-lg-6"}>
              <ul className={`nav nav-tabs mb-2`}>
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === Tab.Editor ? "active" : ""}`}
                    aria-current="page"
                    onClick={() => setTab(Tab.Editor)}
                  >
                    Editor
                  </button>
                </li>
                {NearConfig.widgets.widgetMetadataEditor && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        tab === Tab.Metadata ? "active" : ""
                      }`}
                      aria-current="page"
                      onClick={() => setTab(Tab.Metadata)}
                    >
                      Metadata
                    </button>
                  </li>
                )}
              </ul>

              <div className={`${tab === Tab.Editor ? "" : "visually-hidden"}`}>
                <div className="form-control mb-3" style={{ height: "70vh" }}>
                  <PropertyCreator
                    addProperty={(property) =>
                      setProperties([...properties, property])
                    }
                    removeProperty={(property) =>
                      setProperties(properties.filter((it) => it !== property))
                    }
                    properties={properties}
                  />
                </div>
                <div className="mb-3 d-flex gap-2 flex-wrap">
                  {!path?.unnamed && commitButton}
                  <button
                    className={`btn ${
                      path?.unnamed ? "btn-primary" : "btn-secondary"
                    }`}
                    onClick={() => {
                      setShowRenameModal(true);
                    }}
                  >
                    Rename {path?.type}
                  </button>
                  {path && accountId && (
                    <a
                      className="btn btn-outline-primary"
                      href={`#/${typePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Component in a new tab
                    </a>
                  )}
                </div>
              </div>
              <div
                className={`${
                  tab === Tab.Metadata &&
                  NearConfig.widgets.widgetMetadataEditor
                    ? ""
                    : "visually-hidden"
                }`}
              >
                <div className="mb-3">
                  <Widget
                    src={NearConfig.widgets.widgetMetadataEditor}
                    key={`metadata-editor-${jpath}`}
                    props={useMemo(
                      () => ({
                        typePath,
                        onChange: setMetadata,
                      }),
                      [typePath]
                    )}
                  />
                </div>
                <div className="mb-3">{commitButton}</div>
              </div>
            </div>
            <div
              className={`${
                tab === Tab.Widget || tab !== Tab.Metadata
                  ? "col-lg-6"
                  : "visually-hidden"
              }`}
            >
              <div className="container">
                <div className="row">
                  <div className="d-inline-block position-relative overflow-hidden">
                    <TypePreview properties={properties} />
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`${
                tab === Tab.Metadata ? "col-lg-6" : "visually-hidden"
              }`}
            >
              <div className="container">
                <div className="row">
                  <div className="d-inline-block position-relative overflow-hidden">
                    <Widget
                      key={`metadata-${jpath}`}
                      src={NearConfig.widgets.widgetMetadata}
                      props={useMemo(
                        () => ({ metadata, accountId, typeName }),
                        [metadata, accountId, typeName]
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
