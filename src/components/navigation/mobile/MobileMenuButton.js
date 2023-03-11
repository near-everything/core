import React from "react";
import styled from "styled-components";

const StyledMobileMenuButton = styled.button`
  background-color: transparent;
  border: none;
  display: flex;
  align-items: center;
  color: white;
  font-weight: var(--font-weight-bold);
  padding: 0;

  .menu {
    width: 56px;
    height: 56px;
    border-radius: 100%;
    display: flex;
    background-color: black;
    flex-direction: column;
    justify-content: space-evenly;
    margin-right: 10px;

    div {
      background-color: white;
      height: 2px;
      width: 100%;
      border-radius: 30px;
    }
  }
`;

export function MobileMenuButton(props) {
  return (
    <StyledMobileMenuButton onClick={props.onClick}>
      <div className="menu" />
      {/* {props.currentPage} */}
    </StyledMobileMenuButton>
  );
}
