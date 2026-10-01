<script>
import { Comment, Fragment, Text, h } from "vue";
import { ElTableColumn } from "element-plus";
import { buildTableHeaderPlan } from "../utils/table-header-groups.js";

function flattenColumns(nodes) {
    return nodes.flatMap((node) => {
        if (!node || node.type === Comment || (node.type === Text && !String(node.children || "").trim())) return [];
        return node.type === Fragment ? flattenColumns(node.children || []) : [node];
    });
}

export default {
    name: "GroupedTableColumns",
    props: {
        headers: { type: [String, Array], default: "" },
        fields: { type: Array, default: () => [] }
    },
    setup(props, { slots }) {
        return () => {
            const columns = flattenColumns(slots.default?.() || []);
            const plan = buildTableHeaderPlan(props.headers, props.fields);
            if (!plan.length || columns.length !== props.fields.length) return h(Fragment, null, columns);
            const renderGroup = (group) => h(ElTableColumn, {
                label: group.label,
                headerAlign: "center",
                key: `mci-header-${group.start}-${group.end}`
            }, {
                default: () => group.children.map((child) => child.index !== undefined
                    ? columns[child.index]
                    : renderGroup(child))
            });
            const result = [];
            let index = 0;
            for (const group of plan) {
                while (index < group.start) result.push(columns[index++]);
                result.push(renderGroup(group));
                index = group.end + 1;
            }
            while (index < columns.length) result.push(columns[index++]);
            return h(Fragment, null, result);
        };
    }
};
</script>
