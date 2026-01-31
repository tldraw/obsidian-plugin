import React, { PropsWithChildren } from "react";
import Setting from "./Setting";

export interface SettingGroupProps {
    name: string;
    description?: string;
}

export default function SettingGroup({
    name,
    description,
    children
}: PropsWithChildren<SettingGroupProps>) {
    return (
        <Setting.Container>
            <Setting heading slots={{ name, desc: description }} />
            {children}
        </Setting.Container>
    );
}
