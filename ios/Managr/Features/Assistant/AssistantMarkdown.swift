import SwiftUI

// MARK: - Blocks

enum AssistantMarkdownBlock {
    case paragraph(String)
    case heading(level: Int, text: String)
    case list(ordered: Bool, start: Int, items: [AssistantMarkdownItem])
    case table(header: [String], rows: [[String]], align: [AssistantTableAlignment])
    case code(text: String)
    case quote(String)
    case rule
}

struct AssistantMarkdownItem {
    let text: String
    let checked: Bool?
}

enum AssistantTableAlignment {
    case left
    case center
    case right
}

/// A small Markdown reader for assistant answers: headings, emphasis, inline
/// code, links, lists, task lists, tables, quotes, rules, and fenced code.
/// Raw HTML is never executed; a half-streamed marker simply stays visible.
enum AssistantMarkdown {
    static func parse(_ source: String) -> [AssistantMarkdownBlock] {
        let normalised = source
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let lines = normalised.components(separatedBy: "\n")
        var blocks: [AssistantMarkdownBlock] = []
        var index = 0

        while index < lines.count {
            let line = lines[index]
            if line.trimmed.isEmpty {
                index += 1
                continue
            }

            if let fence = fenceInfo(line) {
                var body: [String] = []
                index += 1
                while index < lines.count {
                    if isClosingFence(lines[index], marker: fence.marker) { break }
                    body.append(lines[index])
                    index += 1
                }
                if index < lines.count { index += 1 }
                blocks.append(.code(text: body.joined(separator: "\n")))
                continue
            }

            if let heading = headingInfo(line) {
                blocks.append(.heading(level: heading.level, text: heading.text))
                index += 1
                continue
            }

            if isRule(line) {
                blocks.append(.rule)
                index += 1
                continue
            }

            if line.trimmed.hasPrefix(">") {
                var body: [String] = []
                while index < lines.count, lines[index].trimmed.hasPrefix(">") {
                    var quoted = lines[index].trimmed
                    quoted.removeFirst()
                    if quoted.hasPrefix(" ") { quoted.removeFirst() }
                    body.append(quoted)
                    index += 1
                }
                blocks.append(.quote(body.joined(separator: "\n")))
                continue
            }

            if let table = parseTable(lines, start: index) {
                blocks.append(table.block)
                index = table.next
                continue
            }

            if bulletText(line) != nil || numberedText(line) != nil {
                let ordered = numberedText(line) != nil
                let start = numberedText(line)?.number ?? 1
                var items: [AssistantMarkdownItem] = []
                while index < lines.count {
                    let current = lines[index]
                    let raw: String?
                    if ordered {
                        raw = numberedText(current)?.text
                    } else {
                        raw = bulletText(current)
                    }
                    if let raw {
                        if let task = taskText(raw) {
                            items.append(AssistantMarkdownItem(text: task.text, checked: task.checked))
                        } else {
                            items.append(AssistantMarkdownItem(text: raw, checked: nil))
                        }
                        index += 1
                        continue
                    }
                    // A plain, indented line continues the item it follows.
                    if !current.trimmed.isEmpty, !isBlockStart(current), let last = items.indices.last {
                        items[last] = AssistantMarkdownItem(
                            text: items[last].text + " " + current.trimmed,
                            checked: items[last].checked
                        )
                        index += 1
                        continue
                    }
                    break
                }
                blocks.append(.list(ordered: ordered, start: start, items: items))
                continue
            }

            var paragraph: [String] = []
            while index < lines.count, !lines[index].trimmed.isEmpty, !isBlockStart(lines[index]) {
                paragraph.append(lines[index].trimmed)
                index += 1
            }
            if !paragraph.isEmpty {
                blocks.append(.paragraph(paragraph.joined(separator: "\n")))
            }
        }
        return blocks
    }

    // MARK: Inline

    static func attributed(_ text: String) -> AttributedString {
        var result: AttributedString
        if let parsed = try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace, failurePolicy: .returnPartiallyParsedIfPossible)
        ) {
            result = parsed
        } else {
            result = AttributedString(text)
        }
        for run in result.runs {
            if run.inlinePresentationIntent?.contains(.code) == true {
                result[run.range].font = .system(size: 13, design: .monospaced)
                result[run.range].foregroundColor = Theme.pineDeep
            }
            if run.link != nil {
                result[run.range].foregroundColor = Theme.pine
                result[run.range].underlineStyle = .single
            }
        }
        return result
    }

    // MARK: Line helpers

    private struct Fence {
        let marker: Character
        let size: Int
    }

    private static func fenceInfo(_ line: String) -> Fence? {
        let trimmed = line.trimmed
        guard trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~") else { return nil }
        let marker = trimmed.first ?? "`"
        let size = trimmed.prefix { $0 == marker }.count
        guard size >= 3 else { return nil }
        return Fence(marker: marker, size: size)
    }

    private static func isClosingFence(_ line: String, marker: Character) -> Bool {
        let trimmed = line.trimmed
        guard !trimmed.isEmpty else { return false }
        let size = trimmed.prefix { $0 == marker }.count
        return size >= 3 && trimmed.dropFirst(size).trimmingCharacters(in: .whitespaces).isEmpty
    }

    private static func headingInfo(_ line: String) -> (level: Int, text: String)? {
        let trimmed = line.trimmed
        let hashes = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(hashes) else { return nil }
        let rest = trimmed.dropFirst(hashes)
        guard rest.first == " " else { return nil }
        return (hashes, rest.trimmingCharacters(in: .whitespaces))
    }

    private static func isRule(_ line: String) -> Bool {
        let trimmed = line.trimmed.replacingOccurrences(of: " ", with: "")
        guard trimmed.count >= 3, let first = trimmed.first, "-*_".contains(first) else { return false }
        return trimmed.allSatisfy { $0 == first }
    }

    private static func bulletText(_ line: String) -> String? {
        let trimmed = line.trimmed
        for marker in ["- ", "* ", "+ "] where trimmed.hasPrefix(marker) {
            return String(trimmed.dropFirst(marker.count))
        }
        return nil
    }

    private static func numberedText(_ line: String) -> (number: Int, text: String)? {
        let trimmed = line.trimmed
        let digits = trimmed.prefix { $0.isNumber }
        guard (1...3).contains(digits.count), digits.count < trimmed.count else { return nil }
        let rest = trimmed.dropFirst(digits.count)
        guard rest.hasPrefix(".") || rest.hasPrefix(")") else { return nil }
        let body = rest.dropFirst()
        guard body.hasPrefix(" ") else { return nil }
        guard let number = Int(digits) else { return nil }
        return (number, String(body.dropFirst()))
    }

    private static func taskText(_ raw: String) -> (checked: Bool, text: String)? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3 else { return nil }
        let lower = trimmed.lowercased()
        if lower.hasPrefix("[x] ") { return (true, String(trimmed.dropFirst(4))) }
        if lower.hasPrefix("[ ] ") { return (false, String(trimmed.dropFirst(4))) }
        return nil
    }

    private static func isBlockStart(_ line: String) -> Bool {
        fenceInfo(line) != nil
            || headingInfo(line) != nil
            || isRule(line)
            || bulletText(line) != nil
            || numberedText(line) != nil
            || line.trimmed.hasPrefix(">")
    }

    // MARK: Tables

    private static func parseTable(
        _ lines: [String],
        start: Int
    ) -> (block: AssistantMarkdownBlock, next: Int)? {
        guard start + 1 < lines.count else { return nil }
        let headerLine = lines[start]
        let delimiterLine = lines[start + 1]
        guard headerLine.contains("|"), delimiterLine.contains("|") else { return nil }
        let header = splitTableRow(headerLine)
        let delimiter = splitTableRow(delimiterLine)
        guard !header.isEmpty, delimiter.count == header.count else { return nil }
        guard delimiter.allSatisfy({ cell in
            let text = cell.replacingOccurrences(of: ":", with: "")
            return text.count >= 3 && text.allSatisfy { $0 == "-" }
        }) else { return nil }

        var rows: [[String]] = []
        var index = start + 2
        while index < lines.count {
            let line = lines[index]
            if line.trimmed.isEmpty || !line.contains("|") { break }
            if isBlockStart(line) { break }
            let cells = splitTableRow(line)
            rows.append(header.indices.map { cells.indices.contains($0) ? cells[$0] : "" })
            index += 1
        }
        let align = delimiter.map { cell -> AssistantTableAlignment in
            let left = cell.hasPrefix(":")
            let right = cell.hasSuffix(":")
            if left && right { return .center }
            if right { return .right }
            return .left
        }
        return (.table(header: header, rows: rows, align: align), index)
    }

    private static func splitTableRow(_ line: String) -> [String] {
        var inner = line.trimmed
        if inner.hasPrefix("|") { inner.removeFirst() }
        if inner.hasSuffix("|") { inner.removeLast() }
        return inner
            .replacingOccurrences(of: "\\|", with: "\u{0001}")
            .components(separatedBy: "|")
            .map { $0.replacingOccurrences(of: "\u{0001}", with: "|").trimmingCharacters(in: .whitespaces) }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

// MARK: - Rendering

struct AssistantMarkdownView: View {
    let text: String

    var body: some View {
        let blocks = AssistantMarkdown.parse(text)
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                AssistantMarkdownBlockView(block: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
    }
}

private struct AssistantMarkdownBlockView: View {
    let block: AssistantMarkdownBlock

    var body: some View {
        switch block {
        case .paragraph(let text):
            Text(AssistantMarkdown.attributed(text))
                .font(.system(size: 14))
                .foregroundStyle(Theme.ink)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        case .heading(let level, let text):
            Text(AssistantMarkdown.attributed(text))
                .font(.display(level <= 2 ? 18 : 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        case .list(let ordered, let start, let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        if let checked = item.checked {
                            Image(systemName: checked ? "checkmark.square.fill" : "square")
                                .font(.system(size: 12))
                                .foregroundStyle(checked ? Theme.moss : Theme.muted)
                        } else {
                            Text(ordered ? "\(start + index)." : "•")
                                .font(ordered ? .mono(12) : .system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.muted)
                                .frame(minWidth: ordered ? 18 : 10, alignment: .trailing)
                        }
                        Text(AssistantMarkdown.attributed(item.text))
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.ink)
                            .lineSpacing(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        case .table(let header, let rows, let align):
            ScrollView(.horizontal, showsIndicators: false) {
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                    GridRow {
                        ForEach(Array(header.enumerated()), id: \.offset) { index, cell in
                            Text(AssistantMarkdown.attributed(cell))
                                .font(.system(size: 12, weight: .semibold))
                                .frame(maxWidth: .infinity, alignment: alignment(align, index))
                        }
                    }
                    Divider().overlay(Theme.line).gridCellColumns(header.count)
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        GridRow {
                            ForEach(Array(row.enumerated()), id: \.offset) { index, cell in
                                Text(AssistantMarkdown.attributed(cell))
                                    .font(.system(size: 12))
                                    .foregroundStyle(Theme.ink)
                                    .frame(maxWidth: .infinity, alignment: alignment(align, index))
                            }
                        }
                    }
                }
                .padding(10)
            }
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.line, lineWidth: 1))
        case .code(let text):
            ScrollView(.horizontal, showsIndicators: false) {
                Text(text)
                    .font(.mono(11))
                    .foregroundStyle(Theme.ink)
                    .padding(9)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        case .quote(let text):
            HStack(alignment: .top, spacing: 8) {
                Rectangle()
                    .fill(Theme.line)
                    .frame(width: 2)
                Text(AssistantMarkdown.attributed(text))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .fixedSize(horizontal: false, vertical: true)
        case .rule:
            Divider().overlay(Theme.line)
        }
    }

    private func alignment(_ values: [AssistantTableAlignment], _ index: Int) -> Alignment {
        guard values.indices.contains(index) else { return .leading }
        switch values[index] {
        case .left: return .leading
        case .center: return .center
        case .right: return .trailing
        }
    }
}