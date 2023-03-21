import prettier from "prettier";
import parserBabel from "prettier/parser-babel";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "react-bootstrap";
import { useHistory, useParams } from "react-router-dom";
import { useAccountId } from "../../data/account";
import { useCache } from "../../data/cache";
import { NearConfig, useNear } from "../../data/near";
import { CreateWidget, ViewWidget } from "../../data/widgets";
import { CommitButton } from "../Commit";
import OpenModal from "../Editor/OpenModal";
import RenameModal from "../Editor/RenameModal";
import { Widget } from "../Widget/Widget";
import PropertyCreator from "./PropertyCreator";
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
  const [genCreate, setGenCreate] = useState(false);
  const [genView, setGenView] = useState(false);
  const [genSummary, setGenSummary] = useState(false);

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
      console.log(json);
      setProperties(JSON.parse(json)?.properties || []);
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
    const data = {
      properties: properties,
      widgets: {},
    };
    data.widgets.summary = genSummary
      ? `${accountId}/widget/Everything.Summary.${typeName}`
      : data.widgets.summary;
    data.widgets.view = genView
      ? `${accountId}/widget/Everything.View.${typeName}`
      : data.widgets.view;
    data.widgets.create = genCreate
      ? `${accountId}/widget/Everything.Create.${typeName}`
      : data.widgets.create;
    return JSON.stringify(data);
  };

  const generateSummary = () => {
    return ViewWidget.replace(
      "{SVG}",
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 12C17 14.76 14.76 17 12 17V7C14.76 7 17 9.24 17 12Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7V17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22V17" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7V2" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    ).replace(
      "{DATA}",
      properties
        .map((it) => {
          switch (it.type) {
            case "String":
              return `<p>{data["${it.name}"]}</p>`;
            case "md":
              return `<Markdown text={data["${it.name}"]} />`;
            default:
              return;
          }
        })
        .join(" ")
    );
  };

  const generateView = () => {
    return ViewWidget.replace(
      "{SVG}",
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 12C17 14.76 14.76 17 12 17V7C14.76 7 17 9.24 17 12Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7V17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22V17" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7V2" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    ).replace(
      "{DATA}",
      properties
        .map((it) => {
          switch (it.type) {
            case "String":
              return `<p>{data["${it.name}"]}</p>`;
            case "md":
              return `<Markdown text={data["${it.name}"]} />`;
            default:
              return;
          }
        })
        .join(" ")
    );
  };

  const generateCreate = () => {
    const initState = properties.reduce((p, { name }) => {
      p[name] = "";
      return p;
    }, {});

    return CreateWidget.replace("TYPE_STR", `${accountId}/type/${typeName}`)
      .replace("PROPERTIES", JSON.stringify(initState))
      .replace("VERSION", "tempeverything")
      .replace(
        "{FORM_BODY}",
        properties
          .map((it) => {
            switch (it.type) {
              case "String":
                return `<Input placeholder="${it.name}" onChange={({ target }) => State.update({ "${it.name}": target.value })} />`;
              case "md":
                return `<TextArea placeholder="${it.name}" onInput={({ target }) => State.update({ "${it.name}": target.value })} />`;
              default:
                return;
            }
          })
          .join(" ")
      );
  };

  const composeData = () => {
    const data = {
      type: {
        [typeName]: {
          "": generateJson(),
          metadata,
        },
      },
    };

    if (genSummary || genView || genCreate) {
      data.widget = {};
      if (genSummary) {
        data.widget[`Everything.Summary.${typeName}`] = {
          "": generateSummary(),
        };
      }
      if (genView) {
        data.widget[`Everything.View.${typeName}`] = {
          "": generateView(),
        };
      }
      if (genCreate) {
        data.widget[`Everything.Create.${typeName}`] = {
          "": generateCreate(),
          metadata: {
            tags: {
              "everything-creator": "",
            },
          },
        };
      }
    }
    return data;
  };

  const commitButton = (
    <CommitButton
      className="btn btn-primary"
      disabled={!typeName}
      near={near}
      data={composeData()}
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
                <div
                  className="form-control mb-3 overflow-scroll d-flex flex-column justify-content-between"
                  style={{ height: "70vh" }}
                >
                  <PropertyCreator
                    addProperty={(property) =>
                      setProperties([...properties, property])
                    }
                    removeProperty={(property) =>
                      setProperties(properties.filter((it) => it !== property))
                    }
                    properties={properties}
                  />
                  <div>
                    <div className="form-group">
                      <input
                        id="genSummary"
                        className="form-check-input"
                        type="checkbox"
                        value={genView}
                        onChange={(e) => setGenSummary(!genSummary)}
                      />
                      <label class="form-check-label" for="genSummary">
                        Autogenerate Summary Widget
                      </label>
                    </div>
                    <div className="form-group">
                      <input
                        id="genView"
                        className="form-check-input"
                        type="checkbox"
                        value={genView}
                        onChange={(e) => setGenView(!genView)}
                      />
                      <label class="form-check-label" for="genView">
                        Autogenerate View Widget
                      </label>
                    </div>
                    <div className="form-group">
                      <input
                        id="genCreate"
                        className="form-check-input"
                        type="checkbox"
                        value={genCreate}
                        onChange={(e) => setGenCreate(!genCreate)}
                      />
                      <label class="form-check-label" for="genCreate">
                        Autogenerate Create Widget
                      </label>
                    </div>
                  </div>
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
