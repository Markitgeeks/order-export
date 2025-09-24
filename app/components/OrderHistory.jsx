import {
  IndexTable,
  LegacyCard,
  Text,
  useBreakpoints,
  Box,
  Page,
  BlockStack,
  InlineStack,
  Link,
  TextField,
  Badge,
  Spinner,
} from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import { useCallback, useState, useMemo, useEffect } from 'react';

function OrderHistory({ exportHistories }) {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const breakpoints = useBreakpoints();
  const condensed = breakpoints.smDown;
  const [queryValue, setQueryValue] = useState('');

  const handleQueryChange = useCallback((value) => {
    setQueryValue(value);
    setCurrentPage(1);
  }, []);

  const handleQueryClear = useCallback(() => {
    setQueryValue('');
    setCurrentPage(1);
  }, []);
useEffect(() => {
  if (exportHistories && exportHistories.length > 0) {
    setLoading(false);
  } else {
    setLoading(true);
  }
}, [exportHistories]);
  const filteredHistories = useMemo(() => {
    if (!queryValue) return exportHistories;
    const lowerQuery = queryValue.toLowerCase();
    return exportHistories.filter(
      ({ filename, exported_at, order_count }) =>
        filename.toLowerCase().includes(lowerQuery) ||
        new Date(exported_at).toLocaleDateString().includes(lowerQuery) ||
        order_count.toString().includes(lowerQuery)
    );
  }, [exportHistories, queryValue]);

  const paginatedHistories = useMemo(
    () => filteredHistories.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredHistories, currentPage, pageSize]
  );

  const startIdx = filteredHistories.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, filteredHistories.length);
  const paginationLabel = `${startIdx} - ${endIdx} of ${filteredHistories.length}`;

  const formatOrderCount = (count) => (
    <Badge tone="success" progress="complete">
      {count} {count === 1 ? 'Order' : 'Orders'}
    </Badge>
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      <Text variant="bodyMd" tone="subdued">
        {date.toLocaleDateString()} {date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    );
  };

  const rowMarkup = paginatedHistories.map(
    ({ _id, filename, exported_at, order_count, file_path }, index) => (
      <IndexTable.Row id={_id} key={_id} position={index}>
        {condensed ? (
          <div style={{ padding: '12px 16px', width: '100%' }}>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodyMd" fontWeight="semibold" as="span">
                  {filename}
                </Text>
                <Link url={file_path} target="_blank" monochrome>
                  <Text variant="bodyMd" fontWeight="medium" tone="interactive">
                    Download
                  </Text>
                </Link>
              </InlineStack>
              <BlockStack gap="100">
                <Text variant="bodySm" as="span" tone="subdued">
                  {formatDate(exported_at)}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {formatOrderCount(order_count)}
                  <Text variant="bodySm" tone="subdued">
                    • {filename.split('_')[0]} export
                  </Text>
                </div>
              </BlockStack>
            </BlockStack>
          </div>
        ) : (
          <>
            <IndexTable.Cell>
              <Text>{(currentPage - 1) * pageSize + index + 1}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack align="start" gap="200">
                <Text variant="bodyMd" fontWeight="semibold" as="span">
                  📝 {filename}
                </Text>
                <Badge tone="info" size="small">
                  CSV
                </Badge>
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>{formatDate(exported_at)}</IndexTable.Cell>
            <IndexTable.Cell>{formatOrderCount(order_count)}</IndexTable.Cell>
            <IndexTable.Cell>
              <Link url={file_path} target="_blank" monochrome>
                <InlineStack>
                  <Text variant="bodyMd" tone="interactive">
                    Download
                  </Text>
                </InlineStack>
              </Link>
            </IndexTable.Cell>
          </>
        )}
      </IndexTable.Row>
    )
  );

  return (
    <Page
      fullWidth
    >
 <TitleBar title="Order Export History">
            </TitleBar>
      {!loading ? <LegacyCard>
        <Box paddingBlockEnd="400">
          <Box padding="400">
            <TextField
              label="Search exports"
              value={queryValue}
              onChange={handleQueryChange}
              placeholder="Search by filename or date..."
              clearButton
              onClearButtonClick={handleQueryClear}
              prefix={
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Text variant="bodySm" tone="subdued">
                    {filteredHistories.length}
                  </Text>
                </div>
              }
            />
          </Box>

          <IndexTable
            condensed={condensed}
            resourceName={{ singular: 'export', plural: 'exports' }}
            itemCount={paginatedHistories.length}
            headings={[
              { title: 'S.no', hidden: condensed },
              { title: 'Filename', hidden: condensed },
              { title: 'Date', hidden: condensed },
              { title: 'Order Count', hidden: condensed },
              { title: 'Download CSV', hidden: condensed },
            ]}
            selectable={false}
            pagination={{
              hasPrevious: currentPage > 1,
              hasNext: currentPage * pageSize < filteredHistories.length,
              onPrevious: () => setCurrentPage((prev) => Math.max(prev - 1, 1)),
              onNext: () => setCurrentPage((prev) => prev + 1),
              label: paginationLabel,
            }}
          >
            {rowMarkup}
          </IndexTable>
        </Box>
      </LegacyCard> :  <InlineStack align='center'><Spinner accessibilityLabel="Spinner example" size="large" />  </InlineStack>}
    </Page>
  );
}

export default OrderHistory;
