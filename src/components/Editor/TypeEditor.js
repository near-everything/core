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
import { CommitButton } from "../Commit";
import OpenModal from "../Editor/OpenModal";
import RenameModal from "../Editor/RenameModal";
import { Widget } from "../Widget/Widget";

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

const EditorLayoutKey = LsKey + "editorLayout:";

const DefaultEditorJson = "{}";

const Tab = {
  Editor: "Editor",
  Metadata: "Metadata",
  Type: "Type",
};

const Layout = {
  Tabs: "Tabs",
  Split: "Split",
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

  const [renderJson, setRenderJson] = useState(json);
  const [metadata, setMetadata] = useState(undefined);
  const near = useNear();
  const cache = useCache();
  const accountId = useAccountId();

  const [tab, setTab] = useState(Tab.Editor);
  const [layout, setLayoutState] = useState(
    ls.get(EditorLayoutKey) || Layout.Tabs
  );

  const setLayout = useCallback(
    (layout) => {
      ls.set(EditorLayoutKey, layout);
      setLayoutState(layout);
    },
    [setLayoutState]
  );

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

  const layoutClass = layout === Layout.Split ? "col-lg-6" : "";

  const onLayoutChange = useCallback(
    (e) => {
      const layout = e.target.value;
      if (layout === Layout.Split && tab === Tab.Widget) {
        setTab(Tab.Editor);
      }
      setLayout(layout);
    },
    [setLayout, tab, setTab]
  );

  const typeName = path?.name;

  const commitButton = (
    <CommitButton
      className="btn btn-primary"
      disabled={!typeName}
      near={near}
      data={{
        type: {
          [typeName]: {
            "": json,
            metadata,
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
        <div className="me-2">
          <div
            className="btn-group-vertical"
            role="group"
            aria-label="Layout selection"
          >
            <input
              type="radio"
              className="btn-check"
              name="layout-radio"
              id="layout-tabs"
              autoComplete="off"
              checked={layout === Layout.Tabs}
              onChange={onLayoutChange}
              value={Layout.Tabs}
              title={"Set layout to Tabs mode"}
            />
            <label className="btn btn-outline-secondary" htmlFor="layout-tabs">
              <i className="bi bi-square" />
            </label>

            <input
              type="radio"
              className="btn-check"
              name="layout-radio"
              id="layout-split"
              autoComplete="off"
              checked={layout === Layout.Split}
              value={Layout.Split}
              title={"Set layout to Split mode"}
              onChange={onLayoutChange}
            />
            <label className="btn btn-outline-secondary" htmlFor="layout-split">
              <i className="bi bi-layout-split" />
            </label>
          </div>
        </div>
        <div className="flex-grow-1">
          <div className="row">
            <div className={layoutClass}>
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
                {layout === Layout.Tabs && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        tab === Tab.Widget ? "active" : ""
                      }`}
                      aria-current="page"
                      onClick={() => {
                        setRenderJson(json);
                        setTab(Tab.Widget);
                      }}
                    >
                      Widget Preview
                    </button>
                  </li>
                )}
              </ul>

              <div className={`${tab === Tab.Editor ? "" : "visually-hidden"}`}>
                <div className="form-control mb-3" style={{ height: "70vh" }}>
                  <Editor
                    value={json}
                    path={typePath}
                    defaultLanguage="json"
                    onChange={(json) => updateJson(path, json)}
                    wrapperProps={{
                      onBlur: () => reformat(path, json),
                    }}
                  />
                </div>
                <div className="mb-3 d-flex gap-2 flex-wrap">
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      setRenderJson(json);
                      if (layout === Layout.Tabs) {
                        setTab(Tab.Type);
                      }
                    }}
                  >
                    Render preview
                  </button>
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
                tab === Tab.Metadata ? layoutClass : "visually-hidden"
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
